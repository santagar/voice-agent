import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Minimal metadata stored inside knowledge-items.json.
 * Only the fields needed to build the scope catalog are represented here.
 */
type KnowledgeItem = {
  scope?: string;
  tags?: string[];
};

/**
 * Embeddings generated via npm run build:kb stored in knowledge-vectors.json.
 * Each entry contains the scope and its vector representation.
 */
type KnowledgeVector = {
  id: string;
  scope?: string;
  embedding?: number[];
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let vectorsCache: KnowledgeVector[] | null = null;

function readKnowledgeItems(): KnowledgeItem[] {
  try {
    const filePath = path.join(
      process.cwd(),
      "knowledge",
      "knowledge-items.json"
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read knowledge-items.json:", err);
    return [];
  }
}

function loadKnowledgeVectors(): KnowledgeVector[] {
  if (vectorsCache) return vectorsCache;
  try {
    const filePath = path.join(
      process.cwd(),
      "knowledge",
      "knowledge-vectors.json"
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    vectorsCache = JSON.parse(raw);
  } catch (err) {
    console.error("Failed to load knowledge-vectors.json:", err);
    vectorsCache = [];
  }
  return vectorsCache ?? [];
}

function buildScopes() {
  const items = readKnowledgeItems();
  const map = new Map<string, Set<string>>();

  for (const item of items) {
    if (!item.scope) continue;
    if (!map.has(item.scope)) {
      map.set(item.scope, new Set<string>());
    }
    const keywords = map.get(item.scope)!;
    (item.tags || []).forEach((tag) => {
      if (typeof tag === "string" && tag.trim().length > 0) {
        keywords.add(tag.toLowerCase());
      }
    });
  }

  return Array.from(map.entries()).map(([name, keywords]) => ({
    name,
    keywords: Array.from(keywords),
  }));
}

function cosineSimilarity(a: number[], b: number[]) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * GET /api/scopes
 * Returns every scope + keyword hints so the Lab UI can display the catalog and
 * perform keyword-based fallbacks without hitting the vector service.
 */
export function GET() {
  const scopes = buildScopes();
  return NextResponse.json({ scopes });
}

/**
 * POST /api/scopes
 * Body: { text: string }
 * Takes a snippet of user text, embeds it with OpenAI, and compares the vector
 * against knowledge-vectors.json to find the most likely scope.
 */
export async function POST(req: NextRequest) {
  const { text } = await req.json().catch(() => ({ text: "" }));
  if (!text || typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Body must include non-empty 'text'." },
      { status: 400 }
    );
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY missing on server." },
      { status: 500 }
    );
  }

  const vectors = loadKnowledgeVectors();
  if (!vectors.length) {
    return NextResponse.json(
      { scope: null, reason: "No knowledge vectors available." },
      { status: 200 }
    );
  }

  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const queryEmbedding = embeddingRes.data[0].embedding;

  const scores = new Map<string, number>();
  for (const item of vectors) {
    if (!item.scope || !Array.isArray(item.embedding)) continue;
    const score = cosineSimilarity(queryEmbedding, item.embedding);
    const current = scores.get(item.scope);
    if (current === undefined || score > current) {
      scores.set(item.scope, score);
    }
  }

  let bestScope: string | null = null;
  let bestScore = -Infinity;
  for (const [scope, score] of scores.entries()) {
    if (score > bestScore) {
      bestScope = scope;
      bestScore = score;
    }
  }

  return NextResponse.json({
    scope: bestScope,
    score: Number.isFinite(bestScore) ? bestScore : null,
  });
}
