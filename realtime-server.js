// realtime-server.js
require("dotenv").config();
const WebSocket = require("ws");
const OpenAI = require("openai");

const assistantProfile = require("./config/assistant-profile.json");
const sanitizationRules = require("./config/sanitization-rules.json");
const { tools } = require("./config/tools.json");
const knowledgeItems = loadKnowledgeItems();

// Pre-generated vector store (see scripts/build-knowledge.cjs)
let knowledgeVectors = [];
try {
  // Expected shape: [{ id, scope, tags, languages, text, embedding: number[] }, ...]
  knowledgeVectors = require("./knowledge/knowledge-vectors.json");
  console.log(
    `Loaded ${knowledgeVectors.length} knowledge vectors from knowledge/knowledge-vectors.json`
  );
} catch (e) {
  console.error(
    "Could not load knowledge/knowledge-vectors.json. RAG vector search will be disabled.",
    e.message || e
  );
}

const knowledgeTextById = new Map();
for (const item of knowledgeItems) {
  knowledgeTextById.set(item.id, item);
}
for (const item of knowledgeVectors) {
  if (!knowledgeTextById.has(item.id)) {
    knowledgeTextById.set(item.id, item);
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_REALTIME_URL =
  "wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview"; // adjust if you target a different release
const PORT = process.env.REALTIME_PORT || 4001;

const VECTOR_CONTEXT = {
  MAX_SNIPPETS: 5,
  MAX_CONTEXT_CHARS: 3000,
  MIN_SCORE: 0.2,
};

const pineconeConfig = getPineconeConfig();
const useVectorDb = Boolean(pineconeConfig);
const externalApiConfig = {
  baseUrl:
    process.env.TOOL_API_BASE_URL ||
    process.env.CORE_API_BASE_URL ||
    "http://localhost:3000",
  token: process.env.CORE_API_TOKEN,
};

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const sessionInstructions = buildSessionInstructions(assistantProfile);
const compiledSanitizeRules = compileSanitizationRules(sanitizationRules);
const toolDefinitions = Array.isArray(tools) ? tools : [];
const toolMap = new Map(toolDefinitions.map((tool) => [tool.name, tool]));
const openAITools = toolDefinitions
  .filter((tool) => tool?.name)
  .map((tool) => ({
    type: "function",
    name: String(tool.name),
    description: tool.description || "",
    parameters:
      tool.parameters || {
        type: "object",
        properties: {},
      },
  }));

// Template helpers for RAG context injection.
// We keep these server-side because the context snippets change at runtime
// and we want tight control of how they are prepended to every user turn.
const CONTEXT_HEADER =
  "CONTEXTO INTERNO (información de la empresa, no leer literalmente como un correo):";
const CONTEXT_FOOTER = `INSTRUCCIONES PARA TI, ASISTENTE:
- Usa este contexto solo si es relevante para responder.
- Si el contexto no cubre la pregunta, responde de forma genérica y aclara que no tienes el detalle exacto.
- No inventes datos de reservas, estados o políticas; si no hay información, dilo.`;
const USER_PROMPT_PREFIX = "PREGUNTA DEL USUARIO:";

function buildSessionInstructions(profile) {
  const sections = [];
  const keys = Object.keys(profile || {});

  for (const key of keys) {
    const value = profile[key];
    if (!Array.isArray(value) || !value.length) continue;

    sections.push(key.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase()));
    for (const line of value) {
      sections.push(String(line));
    }
    sections.push("");
  }

  return sections
    .filter((line, idx, arr) => {
      if (line !== "") return true;
      if (idx === 0) return false;
      return idx !== arr.length - 1;
    })
    .join("\n")
    .trim();
}

function compileSanitizationRules(rules) {
  if (!Array.isArray(rules)) return [];

  return rules
    .map((rule) => {
      if (!rule?.pattern) return null;
      try {
        const flags =
          typeof rule.flags === "string" && rule.flags.length > 0
            ? rule.flags
            : "g";
        return {
          description: rule.description || "unnamed rule",
          replacement:
            typeof rule.replacement === "string" ? rule.replacement : "",
          regex: new RegExp(rule.pattern, flags),
        };
      } catch (err) {
        console.error(
          `Invalid sanitization rule pattern "${rule.pattern}":`,
          err
        );
        return null;
      }
    })
    .filter(Boolean);
}

function sanitizeText(text) {
  if (!text || typeof text !== "string") return text;
  let result = text;
  for (const rule of compiledSanitizeRules) {
    result = result.replace(rule.regex, rule.replacement);
  }
  return result;
}

// ------------ RAG utilities based on vectors ------------ //

function cosineSimilarity(a, b) {
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
 * Builds context snippets from vector memory (RAG).
 * - Embeds the question.
 * - Filters by scope if provided (e.g. "general", "support", "tech").
 * - Computes cosine similarity against each entry.
 * - Returns the top-K concatenated while respecting a max length.
 */
async function buildVectorContext(question, options = {}) {
  if (!knowledgeVectors.length && !useVectorDb) return "";

  const scope = options.scope || null;
  const { MAX_SNIPPETS, MAX_CONTEXT_CHARS, MIN_SCORE } = VECTOR_CONTEXT;

  // 1) Embed the question
  const embeddingRes = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: question,
  });

  const queryEmbedding = embeddingRes.data[0].embedding;

  if (useVectorDb) {
    const vectorDbContext = await queryVectorDatabase(
      queryEmbedding,
      scope,
      MAX_CONTEXT_CHARS
    );
    if (vectorDbContext) {
      return vectorDbContext;
    }
  }

  // 2) Similarity against every entry (filtered by scope if provided)
  const scored = knowledgeVectors
    .filter((item) => !scope || item.scope === scope)
    .map((item) => ({
      item,
      score: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_SNIPPETS);

  // 3) Build the textual context payload
  const parts = [];
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

async function queryVectorDatabase(queryEmbedding, scope, charLimit) {
  if (!pineconeConfig) return "";

  try {
    const body = {
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

    const parts = [];
    let totalChars = 0;

    for (const match of matches) {
      const doc = knowledgeTextById.get(match.id);
      if (!doc) continue;
      const block = `[#${doc.id}]\n${doc.text}`;
      if (totalChars + block.length > charLimit) break;
      parts.push(block);
      totalChars += block.length;
    }

    const context = parts.join("\n\n---\n\n").trim();
    return context;
  } catch (err) {
    console.error("Vector DB query failed:", err);
    return "";
  }
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vector DB request failed (${res.status}): ${body}`);
  }
  return res.json();
}

function loadKnowledgeItems() {
  try {
    return require("./knowledge/knowledge-items.json");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") {
      console.error("Could not load knowledge/knowledge-items.json:", err);
    }
    return [];
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
    topK:
      Number(process.env.PINECONE_TOP_K) || VECTOR_CONTEXT.MAX_SNIPPETS,
  };
}

async function handleToolCall(openAiSocket, clientSocket, toolCall) {
  const toolCallId = toolCall?.id;
  const toolName = toolCall?.name;
  let args = {};
  try {
    args =
      typeof toolCall?.arguments === "string"
        ? JSON.parse(toolCall.arguments)
        : {};
  } catch (err) {
    console.error("Failed to parse tool arguments:", err);
  }

  sendToolLog(clientSocket, {
    name: toolName,
    status: "started",
    args,
  });

  let outputPayload = {};

  try {
    const toolMeta = toolMap.get(toolName);
    if (!toolMeta) {
      outputPayload = { error: `Unknown tool: ${toolName}` };
    } else if (toolMeta.routes && externalApiConfig.baseUrl) {
      outputPayload = await callExternalApi(toolMeta.routes, args);
    } else {
      outputPayload = simulateToolResponse(toolName, args);
    }
  } catch (err) {
    outputPayload = {
      error: `Tool ${toolName} crashed: ${err.message || err}`,
    };
    sendToolLog(clientSocket, {
      name: toolName,
      status: "failed",
      args,
      message: err.message || String(err),
    });
  }

  if (!outputPayload.error) {
    sendToolLog(clientSocket, {
      name: toolName,
      status: "succeeded",
      args,
    });
  }

  const toolOutputItem = {
    type: "conversation.item.create",
    item: {
      type: "function_call_output",
      call_id: toolCallId,
      output: JSON.stringify(outputPayload),
    },
  };

  openAiSocket.send(JSON.stringify(toolOutputItem));
  openAiSocket.send(JSON.stringify({ type: "response.create" }));
}

async function callExternalApi(route, args) {
  if (!externalApiConfig.baseUrl) {
    throw new Error("External API not configured (CORE_API_BASE_URL missing).");
  }

  const method = (route.method || "GET").toUpperCase();
  const pathTemplate = route.path || "/";
  const { url, remainingArgs } = buildUrlWithParams(
    externalApiConfig.baseUrl,
    pathTemplate,
    args
  );

  const headers = {
    Accept: "application/json",
  };

  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = "application/json";
  }

  if (externalApiConfig.token) {
    headers.Authorization = `Bearer ${externalApiConfig.token}`;
  }

  const fetchOptions = {
    method,
    headers,
  };

  if (method !== "GET" && method !== "HEAD") {
    fetchOptions.body = JSON.stringify(args);
  }

  const finalUrl =
    method === "GET" && remainingArgs && Object.keys(remainingArgs).length > 0
      ? appendQueryParams(url, remainingArgs)
      : url;

  return performExternalFetch(finalUrl, fetchOptions);
}

async function performExternalFetch(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`External API request failed (${res.status}): ${text}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

function buildUrlWithParams(baseUrl, pathTemplate, args) {
  const usedKeys = new Set();
  const path = pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    if (!(key in args)) {
      throw new Error(`Missing required path param "${key}" for ${pathTemplate}`);
    }
    usedKeys.add(key);
    return encodeURIComponent(String(args[key]));
  });

  const remainingArgs = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (!usedKeys.has(key)) {
      remainingArgs[key] = value;
    }
  }

  const url = new URL(path, baseUrl).toString();

  return { url, remainingArgs };
}

function appendQueryParams(url, params) {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    searchParams.append(key, String(value));
  }

  if ([...searchParams.keys()].length === 0) {
    return url;
  }

  const connector = url.includes("?") ? "&" : "?";
  return `${url}${connector}${searchParams.toString()}`;
}

function sendToolLog(clientSocket, payload) {
  try {
    const message = {
      type: "tool.log",
      name: payload.name,
      status: payload.status,
      args: payload.args,
      message: payload.message,
      timestamp: new Date().toISOString(),
    };
    clientSocket.send(JSON.stringify(message));
  } catch (err) {
    console.error("Failed to send tool log to client:", err);
  }
}

function simulateToolResponse(toolName, args) {
  switch (toolName) {
    case "lookup_booking":
      return simulateBookingLookup(args);
    case "check_availability":
      return simulateAvailability(args);
    default:
      return {
        message: `No simulation defined for ${toolName}.`,
      };
  }
}

function simulateBookingLookup(args) {
  const locator = args?.locator || "UNKNOWN";
  return {
    locator,
    status: "confirmed",
    lead_traveler: "María García",
    check_in: "2024-06-15",
    check_out: "2024-06-18",
    total_price: "EUR 540.00",
    currency: "EUR",
    include_history: Boolean(args?.include_history),
    history: args?.include_history
      ? [
          { ts: "2024-05-01T10:15:00Z", event: "Created by partner API" },
          { ts: "2024-05-05T08:00:00Z", event: "Payment confirmed" },
        ]
      : [],
  };
}

function simulateAvailability(args) {
  const productId = args?.product_id || "unknown-product";
  return {
    product_id: productId,
    start_date: args?.start_date,
    end_date: args?.end_date,
    timezone: "Europe/Madrid",
    available_slots: [
      { date: args?.start_date, seats: 12, price: "EUR 45.00" },
      { date: args?.end_date, seats: 8, price: "EUR 45.00" },
    ],
    message: "Demo availability response (static data).",
  };
}

// ------------ Realtime WebSocket server ------------ //

const wss = new WebSocket.Server({ port: PORT }, () => {
  console.log(`Realtime WS server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (clientSocket) => {
  console.log("Client connected to realtime WS");

  const pendingFunctionCalls = new Map();

  const openAiSocket = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  openAiSocket.on("open", () => {
    console.log("Connected to OpenAI Realtime");
    console.log("Registering tools:", openAITools);

    const sessionUpdate = {
      type: "session.update",
      session: {
        modalities: ["text"],
        instructions: sessionInstructions,
        tools: openAITools.length ? openAITools : undefined,
      },
    };

    openAiSocket.send(JSON.stringify(sessionUpdate));
  });

  // Messages from OpenAI → client (with sanitization)
  openAiSocket.on("message", (data) => {
    const raw = typeof data === "string" ? data : data.toString("utf8");
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // If the payload is not JSON (should be rare), forward it as-is
      console.log("FROM OPENAI (non-JSON):", raw);
      clientSocket.send(raw);
      return;
    }

    // Light logging by event type to avoid huge console spam
    console.log("FROM OPENAI (event):", parsed.type);

    // Only touch events carrying text content
    if (
      parsed.type === "response.text.delta" &&
      typeof parsed.delta === "string"
    ) {
      parsed.delta = sanitizeText(parsed.delta);
    }

    if (
      parsed.type === "response.text.done" &&
      typeof parsed.text === "string"
    ) {
      parsed.text = sanitizeText(parsed.text);
    }

    if (parsed.type === "error") {
      console.error("OpenAI session error payload:", parsed.error || parsed);
    }

    if (
      parsed.type === "response.required_action" &&
      parsed?.required_action?.type === "submit_tool_outputs"
    ) {
      const toolCalls =
        parsed.required_action.submit_tool_outputs?.tool_calls || [];
      for (const call of toolCalls) {
        handleToolCall(openAiSocket, clientSocket, call).catch((err) =>
          console.error("Tool handler error:", err)
        );
      }
    }

    if (parsed.type === "response.output_item.added") {
      const item = parsed.output_item || parsed.item;
      if (item?.type === "function_call") {
        const callId =
          item.call_id || item.id || parsed.output_item_id || parsed.item_id;
        if (callId) {
          pendingFunctionCalls.set(callId, {
            name: item.name || parsed.name || callId,
            arguments: "",
          });
        }
      }
    }

    if (parsed.type === "response.function_call_arguments.delta") {
      const callId = parsed.call_id || parsed.id;
      const delta =
        parsed.delta ||
        parsed.arguments_delta ||
        (typeof parsed.arguments === "string" ? parsed.arguments : "");
      if (!callId || typeof delta !== "string" || delta.length === 0) {
        return;
      }
      const existing =
        pendingFunctionCalls.get(callId) || {
          name: parsed.name || callId,
          arguments: "",
        };
      existing.arguments = (existing.arguments || "") + delta;
      existing.name = existing.name || parsed.name || callId;
      pendingFunctionCalls.set(callId, existing);
    }

    if (parsed.type === "response.function_call_arguments.done") {
      const callId = parsed.call_id || parsed.id;
      if (!callId) return;
      const record = pendingFunctionCalls.get(callId);
      if (!record) return;
      const finalArgs =
        typeof parsed.arguments === "string"
          ? parsed.arguments
          : record.arguments;
      pendingFunctionCalls.delete(callId);
      handleToolCall(openAiSocket, clientSocket, {
        id: callId,
        name: record.name,
        arguments: finalArgs,
      }).catch((err) => console.error("Tool handler error:", err));
    }

    const safeJson = JSON.stringify(parsed);
    clientSocket.send(safeJson);
  });

  openAiSocket.on("close", () => {
    console.log("OpenAI Realtime connection closed");
    clientSocket.close();
  });

  openAiSocket.on("error", (err) => {
    console.error("OpenAI Realtime error:", err);
    clientSocket.close();
  });

  // Messages from the client → OpenAI (with vector RAG context)
  clientSocket.on("message", async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      console.log("FROM CLIENT:", msg);

      if (msg.type === "user_message") {
        let userText = msg.text || "";
        const scope = msg.scope || "general"; // e.g. "support", "tech", etc.

        // Simple guard: trim excessively long prompts
        if (userText.length > 4000) {
          userText = userText.slice(0, 4000);
        }

        // 1) Build vector context (if the KB is loaded)
        let context = "";
        try {
          context = await buildVectorContext(userText, { scope });
        } catch (e) {
          console.error("Error building vector context:", e);
        }

        // 2) Assemble the final text payload for the model
        const textForModel = context
          ? buildContextualPrompt(context, userText)
          : userText;

        // 3) Push it to the Realtime conversation
        const conversationItem = {
          type: "conversation.item.create",
          item: {
            type: "message",
            role: "user",
            content: [
              {
                type: "input_text",
                text: textForModel,
              },
            ],
          },
        };
        openAiSocket.send(JSON.stringify(conversationItem));

        const responseCreate = {
          type: "response.create",
        };
        openAiSocket.send(JSON.stringify(responseCreate));
      }
    } catch (e) {
      console.error("Error parsing message from client:", e);
    }
  });

  clientSocket.on("close", () => {
    console.log("Client closed connection");
    openAiSocket.close();
  });

  clientSocket.on("error", (err) => {
    console.error("Client WS error:", err);
    openAiSocket.close();
  });
});
// Each turn gets a fresh prompt built server-side so we can wrap the latest
// RAG context and guardrails right next to the user's question.
// Each turn gets a fresh prompt built server-side so we can wrap the latest
// RAG context and guardrails right next to the user's question.
function buildContextualPrompt(contextBlock, userText) {
  return `
${CONTEXT_HEADER}
${contextBlock}

${CONTEXT_FOOTER}

${USER_PROMPT_PREFIX}
${userText}
  `.trim();
}
