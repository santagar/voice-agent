#!/usr/bin/env node
require("dotenv/config");

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

// ------------------------------
// CONFIG
// ------------------------------
const KB_DIR = path.join(process.cwd(), "knowledge", "raw");
const OUTPUT_DIR = path.join(process.cwd(), "knowledge");
const ITEMS_FILE = path.join(OUTPUT_DIR, "items.json");
const VECTORS_FILE = path.join(OUTPUT_DIR, "vectors.json");

const TEXT_EXTENSIONS = new Set([".md", ".txt"]);
const CHUNK_SIZE = 800; // Nº máximo de caracteres por chunk

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

// ------------------------------
// MAIN
// ------------------------------
async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("❌ Missing OPENAI_API_KEY");
    process.exit(1);
  }

  const items = loadKnowledgeItems();
  if (!items.length) {
    console.error("❌ No documents found in knowledge/raw.");
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);
  writeJson(ITEMS_FILE, items);
  console.log(`📄 Saved items.json with ${items.length} entries.`);

  const vectors = await buildEmbeddings(items);
  writeJson(VECTORS_FILE, vectors);
  console.log(`🧠 Saved vectors.json with ${vectors.length} embeddings.`);

  await maybeSyncVectorDb(vectors);
}

// ------------------------------
// LOADING RAW DOCUMENTS
// ------------------------------
function loadKnowledgeItems() {
  if (!fs.existsSync(KB_DIR)) {
    console.warn("ℹ️ knowledge/raw not found; creating empty folder.");
    fs.mkdirSync(KB_DIR, { recursive: true });
    return [];
  }

  const files = walkDir(KB_DIR);
  const docs = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".json") docs.push(parseJsonDocument(filePath));
    else if (TEXT_EXTENSIONS.has(ext)) docs.push(...parseTextDocument(filePath));
    else console.log(`⏭️  Skipping ${relativeKbPath(filePath)} (unsupported extension).`);
  }

  return docs
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function walkDir(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap(entry => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walkDir(full) : [full];
    });
}

// ------------------------------
// PARSERS
// ------------------------------
function parseJsonDocument(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  let data;

  try { data = JSON.parse(raw); }
  catch (err) {
    throw new Error(`❌ Invalid JSON in ${relativeKbPath(filePath)}: ${err.message}`);
  }

  return validateItem({
    ...data,
    source_path: relativeKbPath(filePath)
  });
}

function parseTextDocument(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);

  if (lines[0]?.trim() !== "---") {
    throw new Error(
      `❌ File ${relativeKbPath(filePath)} must start with '---' followed by a JSON block`
    );
  }

  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    throw new Error(
      `❌ Missing closing '---' in ${relativeKbPath(filePath)}`
    );
  }

  const metaJson = lines.slice(1, closing).join("\n");
  let meta;

  try { meta = JSON.parse(metaJson); }
  catch (err) {
    throw new Error(
      `❌ Cannot parse metadata JSON in ${relativeKbPath(filePath)}: ${err.message}`
    );
  }

  const body = lines.slice(closing + 1).join("\n").trim();

  // ------------------------------
  // ✔️ CHUNKING DEL TEXTO
  // ------------------------------
  const chunks = chunkText(body, CHUNK_SIZE);

  return chunks.map((chunkText, index) =>
    validateItem({
      id: `${meta.id}-${index + 1}`,
      scope: meta.scope,
      tags: meta.tags,
      languages: meta.languages,
      text: chunkText,
      source_path: relativeKbPath(filePath)
    })
  );
}

// ------------------------------
// VALIDATION
// ------------------------------
function validateItem(item) {
  const required = ["id", "scope", "tags", "languages", "text"];

  required.forEach(field => {
    if (!item[field] || (Array.isArray(item[field]) && !item[field].length)) {
      throw new Error(`❌ Missing field "${field}" in ${item.source_path}`);
    }
  });

  return {
    id: String(item.id),
    scope: String(item.scope),
    tags: item.tags.map(String),
    languages: item.languages.map(String),
    text: String(item.text).trim(),
    source_path: item.source_path
  };
}

// ------------------------------
// CHUNKING FUNCTION
// ------------------------------
function chunkText(text, size) {
  if (text.length <= size) return [text];

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    chunks.push(text.slice(start, start + size).trim());
    start += size;
  }

  return chunks;
}

// ------------------------------
// EMBEDDINGS
// ------------------------------
async function buildEmbeddings(items) {
  const vectors = [];

  for (const item of items) {
    console.log(`🔤 Embedding: ${item.id}`);

    const embeddingRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: item.text
    });

    vectors.push({
      ...item,
      embedding: embeddingRes.data[0].embedding
    });
  }

  return vectors;
}

// ------------------------------
// PINECONE SYNC
// ------------------------------
async function maybeSyncVectorDb(vectors) {
  const config = getPineconeConfig();
  if (!config) {
    console.log("ℹ️ Pinecone sync skipped (no API key or HOST).");
    return;
  }

  console.log(
    `🔄 Syncing ${vectors.length} vectors to Pinecone namespace "${config.namespace}"`
  );

  const batches = chunkArray(vectors, config.batchSize);

  for (const [i, batch] of batches.entries()) {
    const payload = {
      vectors: batch.map(v => ({
        id: v.id,
        values: v.embedding,
        metadata: {
          scope: v.scope,
          tags: v.tags,
          languages: v.languages
        }
      })),
      namespace: config.namespace
    };

    const res = await fetchJson(`${config.indexHost}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": config.apiKey
      },
      body: JSON.stringify(payload)
    });

    console.log(`  • Batch ${i + 1}/${batches.length} synced.`);
  }
}

function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const host = process.env.PINECONE_INDEX_HOST;

  if (!apiKey || !host) return null;

  return {
    apiKey,
    indexHost: host.replace(/\/$/, ""),
    namespace: process.env.PINECONE_NAMESPACE || "default",
    batchSize: Number(process.env.PINECONE_BATCH_SIZE) || 50
  };
}

// ------------------------------
// HELPERS
// ------------------------------
async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`❌ Pinecone error (${res.status}): ${body}`);
  }
  return res.json();
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir);
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

function relativeKbPath(filePath) {
  return path.relative(KB_DIR, filePath);
}

// ------------------------------
main().catch(err => {
  console.error(err);
  process.exit(1);
});
