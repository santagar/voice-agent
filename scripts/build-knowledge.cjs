// scripts/build-knowledge.cjs
require("dotenv/config");

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const KB_DIR = path.join(process.cwd(), "knowledge", "raw");
const OUTPUT_DIR = path.join(process.cwd(), "knowledge");
const ITEMS_FILE = path.join(OUTPUT_DIR, "items.json");
const VECTORS_FILE = path.join(OUTPUT_DIR, "vectors.json");
const TEXT_EXTENSIONS = new Set([".md", ".txt"]);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY in environment");
    process.exit(1);
  }

  const items = loadKnowledgeItems();
  if (!items.length) {
    console.error("No documents found in knowledge/raw.");
    process.exit(1);
  }

  ensureDir(OUTPUT_DIR);
  writeJson(ITEMS_FILE, items);
  console.log(`✅ Saved items.json with ${items.length} entries.`);

  const vectors = await buildEmbeddings(items);
  writeJson(VECTORS_FILE, vectors);
  console.log(
    `✅ Saved vectors.json with ${vectors.length} embeddings.`
  );

  await maybeSyncVectorDb(vectors);
}

function loadKnowledgeItems() {
  if (!fs.existsSync(KB_DIR)) {
    console.warn("knowledge/raw folder not found; creating an empty directory.");
    fs.mkdirSync(KB_DIR, { recursive: true });
    return [];
  }

  const files = walkDir(KB_DIR);
  const docs = [];

  for (const filePath of files) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === ".json") {
      docs.push(parseJsonDocument(filePath));
    } else if (TEXT_EXTENSIONS.has(ext)) {
      docs.push(parseTextDocument(filePath));
    } else {
      console.log(
        `Skipping ${path.relative(KB_DIR, filePath)} (unsupported extension).`
      );
    }
  }

  return docs
    .filter(Boolean)
    .map((item) => ({
      ...item,
      text: item.text.trim(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function walkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseJsonDocument(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Could not parse JSON in ${path.relative(process.cwd(), filePath)}: ${err.message}`
    );
  }

  return validateItem({ ...data, source_path: relativeKbPath(filePath) });
}

function parseTextDocument(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^\uFEFF/, "");
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    throw new Error(
      `File ${relativeKbPath(
        filePath
      )} must start with a JSON block enclosed between ---`
    );
  }

  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    throw new Error(
      `File ${relativeKbPath(
        filePath
      )} is missing the closing '---' delimiter for the JSON block`
    );
  }

  const metaJson = lines.slice(1, closing).join("\n");
  let meta;
  try {
    meta = JSON.parse(metaJson);
  } catch (err) {
    throw new Error(
      `Could not parse the JSON block in ${relativeKbPath(
        filePath
      )}: ${err.message}`
    );
  }

  const body = lines.slice(closing + 1).join("\n").trim();
  return validateItem({
    ...meta,
    text: body,
    source_path: relativeKbPath(filePath),
  });
}

function validateItem(item) {
  const requiredFields = ["id", "scope", "tags", "languages", "text"];
  for (const field of requiredFields) {
    if (
      item[field] === undefined ||
      item[field] === null ||
      (typeof item[field] === "string" && item[field].trim() === "")
    ) {
      throw new Error(
        `Missing required field "${field}" in ${item.source_path || item.id}`
      );
    }
  }

  if (!Array.isArray(item.tags) || !item.tags.length) {
    throw new Error(`Field "tags" must be a non-empty array in ${item.id}`);
  }

  if (!Array.isArray(item.languages) || !item.languages.length) {
    throw new Error(
      `Field "languages" must be a non-empty array in ${item.id}`
    );
  }

  return {
    id: String(item.id),
    scope: String(item.scope),
    tags: item.tags.map(String),
    languages: item.languages.map(String),
    text: String(item.text),
    source_path: item.source_path || null,
  };
}

const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

async function buildEmbeddings(items) {
  const vectors = [];
  for (const item of items) {
    console.log(`Embedding: ${item.id}`);
    const embeddingRes = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: item.text,
    });

    vectors.push({
      id: item.id,
      scope: item.scope,
      tags: item.tags,
      languages: item.languages,
      text: item.text,
      embedding: embeddingRes.data[0].embedding,
    });
  }
  return vectors;
}

async function maybeSyncVectorDb(vectors) {
  const config = getPineconeConfig();
  if (!config) {
    console.log(
      "ℹ️  Skip Pinecone sync (define PINECONE_API_KEY and PINECONE_INDEX_HOST to enable)."
    );
    return;
  }

  console.log(
    `🔄 Syncing ${vectors.length} vectors to Pinecone namespace "${config.namespace}" via ${config.indexHost}`
  );

  const batches = chunkArray(vectors, config.batchSize);

  for (const [batchIndex, batch] of batches.entries()) {
    const payload = {
      vectors: batch.map((item) => ({
        id: item.id,
        values: item.embedding,
        metadata: {
          scope: item.scope,
          tags: item.tags,
          languages: item.languages,
        },
      })),
      namespace: config.namespace,
    };

    const res = await fetchJson(`${config.indexHost}/vectors/upsert`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Api-Key": config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    console.log(
      `  • Batch ${batchIndex + 1}/${batches.length}: upserted ${
        res.upsertedCount ?? batch.length
      } vectors`
    );
  }
}

function getPineconeConfig() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexHost = process.env.PINECONE_INDEX_HOST;
  if (!apiKey || !indexHost) return null;

  return {
    apiKey,
    indexHost: indexHost.replace(/\/$/, ""),
    namespace: process.env.PINECONE_NAMESPACE || "default",
    batchSize: Number(process.env.PINECONE_BATCH_SIZE) || 50,
    topK: Number(process.env.PINECONE_TOP_K) || 5,
  };
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pinecone request failed (${res.status}): ${body}`);
  }
  return res.json();
}

function chunkArray(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

function relativeKbPath(filePath) {
  return path.relative(KB_DIR, filePath) || path.basename(filePath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
