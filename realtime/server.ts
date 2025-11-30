// realtime-server.ts
// NOTE: This is a TypeScript mirror of realtime-server.js.
// It is currently not wired into the runtime scripts; the JS
// version remains the one used by `npm run realtime`. This file
// exists so we can gradually migrate to a typed implementation
// without risking regressions.
// For now we keep the logic identical. We start adding types
// gradually so that we can later enable full type-checking
// without risking regressions.

import dotenv from "dotenv";
import path from "path";
// ws does not ship TS types by default; we rely on a
// lightweight local declaration and ignore the missing
// upstream typings warning for this import.
// @ts-ignore
import WS, { WebSocketServer } from "ws";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { createVad, Vad } from "./vad";

dotenv.config();

type KnowledgeItem = {
  id: string;
  scope?: string;
  tags?: string[];
  languages?: string[];
  text: string;
};

type KnowledgeVector = KnowledgeItem & {
  embedding: number[];
};

type ToolDefinition = {
  name: string;
  kind?: "business" | "session";
  routes?: {
    method?: string;
    path?: string;
    [key: string]: unknown;
  };
  ui_command?: string;
  session_update?: Record<string, unknown>;
  description?: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
};

type PineconeConfig = {
  apiKey: string;
  indexHost: string;
  namespace: string;
  topK: number;
};

type ExternalApiConfig = {
  baseUrl: string;
  token?: string | null;
};

type PendingFunctionCall = {
  name: string;
  arguments: string;
};

type ToolCall = {
  id?: string;
  name?: string;
  arguments?: string;
};

type ClientMessage =
  | {
      type: "user_message";
      text?: string;
      scope?: string;
      conversationId?: string;
      assistantId?: string;
    }
  | {
      type: "client.audio.chunk";
      audio?: string;
    }
  | {
      type: "client.audio.start" | "client.audio.stop";
    }
  | {
      // Fallback for any other messages we might add later.
      type: string;
      [key: string]: unknown;
    };

type OpenAIEvent = {
  type?: string;
  // text streaming
  delta?: string;
  text?: string;
  // audio streaming
  response?: { id?: string };
  id?: string;
  // errors
  error?: { code?: string; message?: string } | null;
  code?: string;
  message?: string;
  // tools
  required_action?: {
    type?: string;
    submit_tool_outputs?: { tool_calls?: ToolCall[] };
  };
  output_item?: Record<string, unknown>;
  item?: Record<string, unknown>;
  output_item_id?: string;
  item_id?: string;
  call_id?: string;
  arguments?: string;
  arguments_delta?: string;
  name?: string;
  response_id?: string;
};

// Note: this file lives in ./realtime (or dist/realtime after build).
// We resolve JSON config relative to the project root so the same
// paths work both in TS and in the compiled JS.
const ROOT_DIR = path.join(__dirname, "..", "..");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const profile = require(path.join(
  ROOT_DIR,
  "config",
  "profile.json"
)) as Record<string, string[]>;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sanitizationRules = require(path.join(
  ROOT_DIR,
  "config",
  "sanitize.json"
)) as SanitizationRuleConfig[];
// eslint-disable-next-line @typescript-eslint/no-var-requires
const toolsConfig = require(path.join(
  ROOT_DIR,
  "config",
  "tools.json"
)) as { tools: ToolDefinition[] };
const { tools } = toolsConfig;
const knowledgeItems = loadKnowledgeItems() as KnowledgeItem[];

// Pre-generated vector store (see scripts/build-knowledge.cjs)
let knowledgeVectors: KnowledgeVector[] = [];
try {
  // Expected shape: [{ id, scope, tags, languages, text, embedding: number[] }, ...]
  knowledgeVectors = require(path.join(
    ROOT_DIR,
    "knowledge",
    "vectors.json"
  )) as KnowledgeVector[];
  console.log(
    `Loaded ${knowledgeVectors.length} knowledge vectors from knowledge/vectors.json`
  );
} catch (e) {
  console.error(
    "Could not load knowledge/vectors.json. RAG vector search will be disabled.",
    e
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
const REALTIME_MODEL =
  process.env.REALTIME_MODEL || "gpt-4o-mini-realtime-preview";
const REALTIME_MODEL_PREMIUM =
  process.env.REALTIME_MODEL_PREMIUM || "gpt-4o-realtime-preview";
const REALTIME_VOICE = process.env.REALTIME_VOICE || "alloy";
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
const PORT = process.env.REALTIME_PORT || 4001;

const VECTOR_CONTEXT = {
  MAX_SNIPPETS: 5,
  MAX_CONTEXT_CHARS: 3000,
  MIN_SCORE: 0.2,
};

// Optional server-side input VAD (disabled by default).
// When INPUT_VAD_ENABLED=true, incoming PCM16 chunks from the
// browser are gated by RNNoise-based VAD before being forwarded
// to the Realtime API.
const INPUT_VAD_ENABLED = process.env.INPUT_VAD_ENABLED === "true";
// Minimum number of VAD-positive frames required within a single
// chunk before we treat it as speech. This helps filter out very
// short vocal noises ("mm", "eh") while still allowing normal speech.
const INPUT_VAD_MIN_FRAMES = Number(
  process.env.INPUT_VAD_MIN_FRAMES ?? "2"
);
// Optional: minimum fraction of frames within a chunk that must be
// classified as speech. This gives a temporal constraint so that
// tiny bursts (e.g. "mmm") are less likely to be forwarded. We keep
// this relatively low and rely on RNNoise itself for denoising.
const INPUT_VAD_MIN_SPEECH_FRACTION = Number(
  process.env.INPUT_VAD_MIN_SPEECH_FRACTION ?? "0.2"
);

const pineconeConfig = getPineconeConfig();
const useVectorDb = Boolean(pineconeConfig);
const externalApiConfig: ExternalApiConfig = {
  baseUrl:
    process.env.TOOL_API_BASE_URL ||
    process.env.CORE_API_BASE_URL ||
    "http://localhost:3000",
  token: process.env.CORE_API_TOKEN ?? null,
};

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Dedicated Prisma client for the realtime bridge. We keep this
// local to the bridge process instead of importing the Next.js
// helper from lib/ to avoid cross-build coupling between the
// app bundle and the standalone Node server.
const prisma = new PrismaClient({
  log:
    process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
});

const sessionInstructions = buildSessionInstructions(profile);
  const compiledSanitizeRules = compileSanitizationRules(sanitizationRules);
const toolDefinitions: ToolDefinition[] = Array.isArray(tools)
  ? (tools as ToolDefinition[])
  : [];
const toolMap = new Map<string, ToolDefinition>(
  toolDefinitions.map((tool) => [tool.name, tool])
);
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

function buildSessionInstructions(profile: Record<string, string[]>) {
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

type SanitizationRuleConfig = {
  description?: string;
  pattern: string;
  flags?: string;
  replacement?: string;
};

type CompiledSanitizationRule = {
  description: string;
  replacement: string;
  regex: RegExp;
};

function compileSanitizationRules(
  rules: SanitizationRuleConfig[]
): CompiledSanitizationRule[] {
  if (!Array.isArray(rules)) return [];

  const compiled: CompiledSanitizationRule[] = [];

  for (const rule of rules) {
    if (!rule?.pattern) continue;
    try {
      const flags =
        typeof rule.flags === "string" && rule.flags.length > 0
          ? rule.flags
          : "g";
      compiled.push({
        description: rule.description || "unnamed rule",
        replacement:
          typeof rule.replacement === "string" ? rule.replacement : "",
        regex: new RegExp(rule.pattern, flags),
      });
    } catch (err) {
      console.error(
        `Invalid sanitization rule pattern "${rule.pattern}":`,
        err
      );
    }
  }

  return compiled;
}

function sanitizeText(text: string) {
  if (!text || typeof text !== "string") return text;
  let result = text;
  for (const rule of compiledSanitizeRules) {
    result = result.replace(rule.regex, rule.replacement);
  }
  return result;
}

// ------------ RAG utilities based on vectors ------------ //

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
 * Builds context snippets from vector memory (RAG).
 * - Embeds the question.
 * - Filters by scope if provided (e.g. "general", "support", "tech").
 * - Computes cosine similarity against each entry.
 * - Returns the top-K concatenated while respecting a max length.
 */
const EMBEDDING_MODEL =
  process.env.EMBEDDING_MODEL || "text-embedding-3-small";

async function buildVectorContext(
  question: string,
  options: { scope?: string } = {}
) {
  if (!knowledgeVectors.length && !useVectorDb) return "";

  const scope = options.scope || null;
  const { MAX_SNIPPETS, MAX_CONTEXT_CHARS, MIN_SCORE } = VECTOR_CONTEXT;

  // 1) Embed the question
  const embeddingRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
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

async function queryVectorDatabase(
  queryEmbedding: number[],
  scope: string | null,
  charLimit: number
): Promise<string> {
  if (!pineconeConfig) return "";

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

async function fetchJson(url: string, options: RequestInit) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vector DB request failed (${res.status}): ${body}`);
  }
  return res.json();
}

function loadKnowledgeItems(): KnowledgeItem[] {
  try {
    return require(path.join(ROOT_DIR, "knowledge", "items.json")) as KnowledgeItem[];
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "MODULE_NOT_FOUND") {
      console.error("Could not load knowledge/items.json:", err);
    }
    return [];
  }
}

function getPineconeConfig(): PineconeConfig | null {
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

async function handleToolCall(
  openAiSocket: { send: (data: string) => void },
  clientSocket: { send: (data: string) => void },
  toolCall: ToolCall,
  context?: { conversationId?: string | null; assistantId?: string | null }
) {
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

  let outputPayload: any = {};
  const conversationId = context?.conversationId || null;
  const assistantId = context?.assistantId || null;

  let dbToolCallId: string | null = null;

  try {
    const toolMeta = toolName ? toolMap.get(toolName) : undefined;
    const displayName = toolMeta?.name || toolName || "unknown_tool";

    // Persist the ToolCall start if we can associate it with a
    // concrete conversation + assistant. If we don't yet have
    // that context (e.g. pure voice greeting), we still execute
    // the tool but skip DB persistence.
    if (conversationId && assistantId) {
      console.log(
        "Persisting ToolCall start for conversation",
        conversationId,
        "assistant",
        assistantId,
        "tool",
        displayName
      );
      try {
        const created = await prisma.toolCall.create({
          data: {
            conversationId,
            assistantId,
            name: displayName,
            kind: toolMeta?.kind || "business",
            status: "started",
            inputJson: args,
          },
        });
        dbToolCallId = created.id;
      } catch (err) {
        console.error("Failed to persist ToolCall start:", err);
      }
    }

    // Log start after we have resolved the tool metadata so
    // we can show a stable name (lookup_booking, etc.) instead
    // of the internal call_id (call_xxx).
    sendToolLog(clientSocket, {
      name: displayName,
      status: "started",
      args,
    });
    if (!toolMeta) {
      outputPayload = { error: `Unknown tool: ${toolName}` };
    } else if (toolMeta.kind === "session") {
      // Session/UI tools are handled locally (no external API),
      // based on their JSON specification (ui_command, session_update, etc.).
      outputPayload = await handleSessionToolCommand(
        openAiSocket,
        clientSocket,
        toolMeta,
        args
      );
    } else if (toolMeta.routes && externalApiConfig.baseUrl) {
      outputPayload = await callExternalApi(toolMeta.routes, args);
    } else if (toolName) {
      outputPayload = simulateToolResponse(toolName, args);
    }
  } catch (err) {
    outputPayload = {
      error: `Tool ${toolName} crashed`,
    };
    sendToolLog(clientSocket, {
      name: toolName || "unknown_tool",
      status: "failed",
      args,
      message: err instanceof Error ? err.message : String(err),
    });

    if (dbToolCallId) {
      try {
        await prisma.toolCall.update({
          where: { id: dbToolCallId },
          data: {
            status: "failed",
            error: err instanceof Error ? err.message : String(err),
            completedAt: new Date(),
          },
        });
      } catch (dbErr) {
        console.error("Failed to persist ToolCall failure:", dbErr);
      }
    }
  }

  if (!outputPayload.error) {
    sendToolLog(clientSocket, {
      name: toolName || "unknown_tool",
      status: "succeeded",
      args,
    });

    if (dbToolCallId) {
      try {
        await prisma.toolCall.update({
          where: { id: dbToolCallId },
          data: {
            status: "succeeded",
            resultJson: outputPayload,
            completedAt: new Date(),
            error: null,
          },
        });
      } catch (dbErr) {
        console.error("Failed to persist ToolCall success:", dbErr);
      }
    }
  } else if (dbToolCallId) {
    // We already logged the failure case above in the catch block.
    try {
      await prisma.toolCall.update({
        where: { id: dbToolCallId },
        data: {
          status: "failed",
          resultJson: outputPayload,
          completedAt: new Date(),
          error:
            typeof outputPayload.error === "string"
              ? outputPayload.error
              : JSON.stringify(outputPayload.error),
        },
      });
    } catch (dbErr) {
      console.error("Failed to persist ToolCall error payload:", dbErr);
    }
  }

  // Create a lightweight system message linked to the tool call so
  // conversation history can show when tools were invoked without
  // polluting the visible chat (the frontend hides system messages).
  if (dbToolCallId && conversationId) {
    try {
      const last = await prisma.message.findFirst({
        where: { conversationId },
        orderBy: { sequence: "desc" },
      });
      const nextSequence = (last?.sequence ?? 0) + 1;
      const status = outputPayload.error ? "failed" : "succeeded";
      const displayName =
        toolMap.get(toolName || "")?.name || toolName || "unknown_tool";

      await prisma.message.create({
        data: {
          conversationId,
          from: "system",
          text: `Tool call ${displayName} (${status})`,
          sequence: nextSequence,
          toolCallId: dbToolCallId,
          meta: {
            turnType: "tool_call",
            toolName: displayName,
            toolStatus: status,
          },
        },
      });

      await prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (dbErr) {
      console.error("Failed to persist ToolCall message:", dbErr);
    }
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

async function callExternalApi(
  route: NonNullable<ToolDefinition["routes"]>,
  args: Record<string, unknown>
) {
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
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  if (externalApiConfig.token) {
    (headers as Record<string, string>).Authorization = `Bearer ${externalApiConfig.token}`;
  }

  const fetchOptions: RequestInit = {
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

async function performExternalFetch(url: string, options: RequestInit) {
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

function buildUrlWithParams(
  baseUrl: string,
  pathTemplate: string,
  args: Record<string, unknown>
) {
  const usedKeys = new Set();
  const path = pathTemplate.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    if (!(key in args)) {
      throw new Error(`Missing required path param "${key}" for ${pathTemplate}`);
    }
    usedKeys.add(key);
    return encodeURIComponent(String(args[key]));
  });

  const remainingArgs: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (!usedKeys.has(key)) {
      remainingArgs[key] = value;
    }
  }

  const url = new URL(path, baseUrl).toString();

  return { url, remainingArgs };
}

function appendQueryParams(
  url: string,
  params: Record<string, unknown>
) {
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

type ToolLogPayload = {
  name?: string;
  status: string;
  args?: Record<string, unknown>;
  message?: string;
};

function sendToolLog(
  clientSocket: { send: (data: string) => void },
  payload: ToolLogPayload
) {
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

function sendUiCommand(
  clientSocket: { send: (data: string) => void },
  command: string,
  args: Record<string, unknown>
) {
  try {
    const message = {
      type: "ui.command",
      command,
      args,
      timestamp: new Date().toISOString(),
    };
    clientSocket.send(JSON.stringify(message));
  } catch (err) {
    console.error("Failed to send UI command to client:", err);
  }
}

function simulateToolResponse(
  toolName: string,
  args: Record<string, unknown>
) {
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

async function handleSessionToolCommand(
  openAiSocket: { send: (data: string) => void },
  clientSocket: { send: (data: string) => void },
  toolMeta: ToolDefinition,
  args: Record<string, unknown>
) {
  const name = String(toolMeta.name || "unknown_session_tool");
  const uiCommand = toolMeta.ui_command || name;

  // Forward a UI command to the client. The client decides how to
  // interpret and act on it (end_call, mute_speaker, etc.).
  sendUiCommand(clientSocket, uiCommand, args || {});

  // Optional: apply session updates based on the tool spec.
  const sessionUpdate = toolMeta.session_update || {};
  if (sessionUpdate && typeof sessionUpdate === "object") {
    // Example: set_voice tool uses { "voiceParam": "voice" }
    if (sessionUpdate.voiceParam) {
      const paramName = String(sessionUpdate.voiceParam);
      const voice =
        typeof args?.[paramName] === "string" && args[paramName].trim()
          ? args[paramName].trim()
          : null;
      if (voice) {
        try {
          openAiSocket.send(
            JSON.stringify({
              type: "session.update",
              session: {
                voice,
              },
            })
          );
        } catch (err) {
          console.error("Failed to update Realtime voice:", err);
          return { error: "Failed to update voice" };
        }
        return { status: "ok", voice };
      }
    }
  }

  return { status: "ok" };
}

function simulateBookingLookup(args: Record<string, unknown>) {
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

function simulateAvailability(args: Record<string, unknown>) {
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

const wss = new WebSocketServer({ port: Number(PORT) }, () => {
  console.log(`Realtime WS server listening on ws://localhost:${PORT}`);
});

wss.on("connection", (clientSocket: WS) => {
  console.log("Client connected to realtime WS");

  const pendingFunctionCalls = new Map<string, PendingFunctionCall>();
  let hasPendingInputAudio = false;
  let inputNoiseFloor = 0;
  let inputVadActive = false;
  let inputVad: Vad | null = null;
  // Per-connection context so we can associate tool calls
  // with the correct conversation and assistant in the DB.
  let currentConversationId: string | null = null;
  let currentAssistantId: string | null = null;

  if (INPUT_VAD_ENABLED) {
    createVad({
      sampleRate: 48000, // ajusta según tu flujo real
      frameMs: 10,
      speechThreshold: 0.8,
    })
      .then((vad) => {
        inputVad = vad;
        console.log("RNNoise VAD initialized for incoming audio");
      })
      .catch((err) => {
        console.error("Failed to initialize RNNoise VAD:", err);
      });
  }

  const openAiSocket = new WS(OPENAI_REALTIME_URL, {
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
        // Enable both text and audio so the same session can
        // handle speech-to-speech conversations end-to-end.
        modalities: ["text", "audio"],
        instructions: sessionInstructions,
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        turn_detection: {
          type: "server_vad",
        },
        voice: REALTIME_VOICE,
        tools: openAITools.length ? openAITools : undefined,
      },
    };

    openAiSocket.send(JSON.stringify(sessionUpdate));
  });

  // Messages from OpenAI → client (text + optional audio)
  openAiSocket.on("message", (data: string | Buffer) => {
    const raw = typeof data === "string" ? data : data.toString("utf8");
    let parsed: OpenAIEvent;

    try {
      parsed = JSON.parse(raw) as OpenAIEvent;
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

    // Forward audio deltas as raw PCM16 to the client as binary frames.
    // The frontend can pipe these into an AudioContext for playback.
    if (
      parsed.type === "response.audio.delta" &&
      typeof parsed.delta === "string" &&
      parsed.delta.length > 0
    ) {
      try {
        const audioBuffer = Buffer.from(parsed.delta, "base64");
        if (audioBuffer.length > 0) {
          clientSocket.send(audioBuffer);
        }
      } catch (err) {
        console.error("Failed to decode audio delta:", err);
      }
    }

    if (
      parsed.type === "response.required_action" &&
      parsed?.required_action?.type === "submit_tool_outputs"
    ) {
      const toolCalls: ToolCall[] =
        parsed.required_action.submit_tool_outputs?.tool_calls || [];
      for (const call of toolCalls) {
        handleToolCall(openAiSocket, clientSocket, call, {
          conversationId: currentConversationId,
          assistantId: currentAssistantId,
        }).catch((err) => console.error("Tool handler error:", err));
      }
    }

    if (parsed.type === "response.output_item.added") {
      const item = parsed.output_item || parsed.item;
      if (item?.type === "function_call") {
        const callId =
          item.call_id || item.id || parsed.output_item_id || parsed.item_id;
        if (typeof callId === "string" && callId) {
          pendingFunctionCalls.set(callId, {
            name: (item as any).name || parsed.name || callId,
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
      handleToolCall(
        openAiSocket,
        clientSocket,
        {
          id: callId,
          name: record.name,
          arguments: finalArgs,
        },
        {
          conversationId: currentConversationId,
          assistantId: currentAssistantId,
        }
      ).catch((err) => console.error("Tool handler error:", err));
    }

    const safeJson = JSON.stringify(parsed);
    clientSocket.send(safeJson);
  });

  openAiSocket.on("close", () => {
    console.log("OpenAI Realtime connection closed");
    clientSocket.close();
  });

  openAiSocket.on("error", (err: unknown) => {
    console.error("OpenAI Realtime error:", err);
    clientSocket.close();
  });

  // Messages from the client → OpenAI (RAG; audio-in disabled for now)
  clientSocket.on("message", async (data: string | Buffer) => {
    try {
      const raw = typeof data === "string" ? data : data.toString("utf8");
      const msg = JSON.parse(raw) as ClientMessage;
      console.log("FROM CLIENT:", msg);

      if (msg.type === "user_message") {
        const msgText = (msg as any).text as string | undefined;
        const msgScope = (msg as any).scope as string | undefined;
        const msgConversationId = (msg as any)
          .conversationId as string | undefined;
        const msgAssistantId = (msg as any)
          .assistantId as string | undefined;

        if (msgConversationId) {
          currentConversationId = msgConversationId;
        }
        if (msgAssistantId) {
          currentAssistantId = msgAssistantId;
        }
        let userText: string = msgText || "";
        const scope: string = msgScope || "general"; // e.g. "support", "tech", etc.

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

      if (msg.type === "client.audio.chunk" && typeof msg.audio === "string") {
        if (openAiSocket.readyState === WebSocket.OPEN && msg.audio.length > 0) {
          if (!INPUT_VAD_ENABLED || !inputVad) {
            // Forward as-is (original behavior)
            openAiSocket.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio: msg.audio,
              })
            );
            hasPendingInputAudio = true;
          } else {
            try {
              const pcm = Buffer.from(msg.audio, "base64");
              if (pcm.length >= 2) {
                const pcm16 = new Int16Array(
                  pcm.buffer,
                  pcm.byteOffset,
                  pcm.byteLength / 2
                );

                const frameSize = inputVad.frameSize;
                let speechFrames = 0;
                let totalFrames = 0;

                for (
                  let i = 0;
                  i + frameSize <= pcm16.length;
                  i += frameSize
                ) {
                  const frame = pcm16.subarray(i, i + frameSize);
                  totalFrames += 1;

                  if (inputVad.isSpeech(frame)) {
                    speechFrames += 1;
                  }
                }

                const hasEnoughFrames =
                  speechFrames >= Math.max(1, INPUT_VAD_MIN_FRAMES);
                const fraction =
                  totalFrames > 0 ? speechFrames / totalFrames : 0;
                const hasEnoughFraction =
                  fraction >= INPUT_VAD_MIN_SPEECH_FRACTION;

                if (hasEnoughFrames && hasEnoughFraction) {
                  openAiSocket.send(
                    JSON.stringify({
                      type: "input_audio_buffer.append",
                      audio: msg.audio,
                    })
                  );
                  hasPendingInputAudio = true;
                  inputVadActive = true;
                } else {
                  inputVadActive = false;
                }
              }
            } catch (err) {
              console.error("Failed to process RNNoise VAD on audio chunk:", err);
            }
          }
        }
      }

      // Control messages from the client to manage audio turns.
      if (msg.type === "client.audio.start") {
        if (openAiSocket.readyState === WebSocket.OPEN) {
          // Clear any previous audio buffer state on the server side.
          openAiSocket.send(
            JSON.stringify({
              type: "input_audio_buffer.clear",
            })
          );
          hasPendingInputAudio = false;
          inputNoiseFloor = 0;
          inputVadActive = false;
        }
      }

      if (msg.type === "client.audio.stop") {
        // With server_vad turn detection enabled, we don't need to force
        // a commit when the client stops streaming. The model will detect
        // turn boundaries from the audio directly. Avoid committing an
        // effectively empty buffer which causes input_audio_buffer_commit_empty.
        hasPendingInputAudio = false;
        inputVadActive = false;
      }
    } catch (e) {
      console.error("Error parsing message from client:", e);
    }
  });

  clientSocket.on("close", () => {
    console.log("Client closed connection");
    openAiSocket.close();
  });

  clientSocket.on("error", (err: unknown) => {
    console.error("Client WS error:", err);
    openAiSocket.close();
  });
});

// Each turn gets a fresh prompt built server-side so we can wrap the latest
// RAG context and guardrails right next to the user's question.
function buildContextualPrompt(contextBlock: string, userText: string) {
  return `
${CONTEXT_HEADER}
${contextBlock}

${CONTEXT_FOOTER}

${USER_PROMPT_PREFIX}
${userText}
  `.trim();
}
