import path from "path";
import OpenAI from "openai";
import { StructuredLogger } from "./logger";

export type KnowledgeItem = {
  id: string;
  scope?: string;
  tags?: string[];
  languages?: string[];
  text: string;
};

export type KnowledgeVector = KnowledgeItem & {
  embedding: number[];
};

export type PineconeConfig = {
  apiKey: string;
  indexHost: string;
  namespace: string;
  topK: number;
};

export type VectorContextLimits = {
  MAX_SNIPPETS: number;
  MAX_CONTEXT_CHARS: number;
  MIN_SCORE: number;
};

export type KnowledgeArtifacts = {
  items: KnowledgeItem[];
  vectors: KnowledgeVector[];
  textById: Map<string, KnowledgeItem>;
};

export const DEFAULT_VECTOR_CONTEXT: VectorContextLimits = {
  MAX_SNIPPETS: 5,
  MAX_CONTEXT_CHARS: 3000,
  MIN_SCORE: 0.2,
};

export function loadKnowledgeArtifacts(
  rootDir: string,
  logger: StructuredLogger
): KnowledgeArtifacts {
  let items: KnowledgeItem[] = [];
  let vectors: KnowledgeVector[] = [];
  const textById = new Map<string, KnowledgeItem>();

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    items = require(path.join(rootDir, "knowledge", "items.json"));
  } catch (err) {
    logger.warn("knowledge.items.load_failed", {
      message: (err as Error)?.message || String(err),
    });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    vectors = require(path.join(rootDir, "knowledge", "vectors.json"));
    logger.info("knowledge.vectors.loaded", { count: vectors.length });
  } catch (err) {
    logger.warn("knowledge.vectors.missing", {
      message: (err as Error)?.message || String(err),
    });
  }

  for (const item of items) {
    textById.set(item.id, item);
  }
  for (const item of vectors) {
    if (!textById.has(item.id)) {
      textById.set(item.id, item);
    }
  }

  return { items, vectors, textById };
}

export function getPineconeConfig(): PineconeConfig | null {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexHost = process.env.PINECONE_INDEX_HOST;
  if (!apiKey || !indexHost) return null;

  return {
    apiKey,
    indexHost: indexHost.replace(/\/$/, ""),
    namespace: process.env.PINECONE_NAMESPACE || "default",
    topK:
      Number(process.env.PINECONE_TOP_K) ||
      DEFAULT_VECTOR_CONTEXT.MAX_SNIPPETS,
  };
}

export function createVectorSearch(params: {
  openai: OpenAI;
  pineconeConfig: PineconeConfig | null;
  knowledge: KnowledgeArtifacts;
  contextLimits?: VectorContextLimits;
  logger: StructuredLogger;
}) {
  const { openai, pineconeConfig, knowledge, logger } = params;
  const limits = params.contextLimits || DEFAULT_VECTOR_CONTEXT;
  const EMBEDDING_MODEL =
    process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  async function buildVectorContext(
    question: string,
    options: { scope?: string } = {}
  ) {
    if (!knowledge.vectors.length && !pineconeConfig) return "";

    const scope = options.scope || null;
    const { MAX_SNIPPETS, MAX_CONTEXT_CHARS, MIN_SCORE } = limits;

    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });
    const queryEmbedding = embeddingRes.data[0].embedding;

    if (pineconeConfig) {
      const vectorDbContext = await queryVectorDatabase(
        queryEmbedding,
        scope,
        MAX_CONTEXT_CHARS,
        pineconeConfig,
        knowledge,
        logger
      );
      if (vectorDbContext) {
        return vectorDbContext;
      }
    }

    const scored = knowledge.vectors
      .filter((item) => !scope || item.scope === scope)
      .map((item) => ({
        item,
        score: cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SNIPPETS);

    const parts: string[] = [];
    let totalChars = 0;

    for (const { item, score } of scored) {
      if (score < MIN_SCORE) continue;

      const block = `[#${item.id}]\n${item.text}`;
      if (totalChars + block.length > MAX_CONTEXT_CHARS) break;

      parts.push(block);
      totalChars += block.length;
    }

    if (!parts.length) return "";

    let context = parts.join("\n\n---\n\n");
    if (context.length > MAX_CONTEXT_CHARS) {
      context = context.slice(0, MAX_CONTEXT_CHARS);
    }

    return context;
  }

  return {
    buildVectorContext,
  };
}

async function queryVectorDatabase(
  queryEmbedding: number[],
  scope: string | null,
  charLimit: number,
  pineconeConfig: PineconeConfig,
  knowledge: KnowledgeArtifacts,
  logger: StructuredLogger
): Promise<string> {
  try {
    const body: {
      vector: number[];
      topK: number;
      namespace: string;
      includeMetadata: boolean;
      includeValues: boolean;
      filter?: { scope: string };
    } = {
      vector: queryEmbedding,
      topK: pineconeConfig.topK,
      namespace: pineconeConfig.namespace,
      includeMetadata: true,
      includeValues: false,
    };

    if (scope) {
      body.filter = { scope };
    }

    const res = await fetchJson(`${pineconeConfig.indexHost}/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": pineconeConfig.apiKey,
      },
      body: JSON.stringify(body),
    });

    const matches = Array.isArray(res.matches) ? res.matches : [];
    if (!matches.length) return "";

    const parts: string[] = [];
    let totalChars = 0;

    for (const match of matches) {
      const doc = knowledge.textById.get(match.id);
      if (!doc) continue;
      const block = `[#${doc.id}]\n${doc.text}`;
      if (totalChars + block.length > charLimit) break;
      parts.push(block);
      totalChars += block.length;
    }

    const context = parts.join("\n\n---\n\n").trim();
    return context;
  } catch (err) {
    logger.warn("vector.query.failed", {
      message: (err as Error)?.message || String(err),
    });
    return "";
  }
}

async function fetchJson(url: string, options: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vector DB request failed (${res.status}): ${body}`);
  }
  return res.json();
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
