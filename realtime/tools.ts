import { performance } from "perf_hooks";
import { PrismaClient } from "@prisma/client";
import { StructuredLogger, MetricsTracker } from "./logger";

const TOOL_CACHE_TTL_MS = 60 * 1000;

export type ExternalApiConfig = {
  baseUrl: string;
  token?: string | null;
};

export type ToolDefinition = {
  id?: string;
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

type ToolCall = {
  id?: string;
  name?: string;
  arguments?: string;
};

type ToolRouterDeps = {
  prisma: PrismaClient;
  externalApiConfig: ExternalApiConfig;
  logger: StructuredLogger;
  metrics: MetricsTracker;
};

type SocketLike = {
  send: (data: any) => void;
};

export function createToolRouter(deps: ToolRouterDeps) {
  const { prisma, externalApiConfig, logger, metrics } = deps;

  let toolDefinitions: ToolDefinition[] = [];
  const toolMap = new Map<string, ToolDefinition>();
  const assistantToolsCache = new Map<
    string,
    { expiresAt: number; tools: { type: "function"; name: string; description: string; parameters: NonNullable<ToolDefinition["parameters"]> }[] }
  >();

  async function loadToolsFromDatabase() {
    try {
      const dbTools = await prisma.tool.findMany({
        where: { status: "active" },
        orderBy: { createdAt: "asc" },
      });

      toolDefinitions = dbTools.map((t) => {
        const def: any = t.definitionJson || {};
        const descriptionFromDef =
          typeof def.description === "string" && def.description.trim()
            ? def.description.trim()
            : "";
        return {
          id: t.id,
          name: t.name,
          kind: (t.kind as any) === "session" ? "session" : "business",
          routes: def.routes,
          ui_command: def.ui_command,
          session_update: def.session_update,
          description: descriptionFromDef,
          parameters:
            def.parameters || ({
              type: "object",
              properties: {},
            } as ToolDefinition["parameters"]),
        };
      });

      toolMap.clear();
      for (const tool of toolDefinitions) {
        toolMap.set(tool.name, tool);
      }

      // Invalidate assistant-level cache whenever the catalog changes.
      assistantToolsCache.clear();
      logger.info("tools.loaded", { count: toolDefinitions.length });
    } catch (err) {
      logger.error("tools.load_failed", {
        error: (err as Error)?.message || String(err),
      });
      toolDefinitions = [];
      toolMap.clear();
    }
  }

  async function buildOpenAIToolsForAssistant(assistantId: string | null) {
    if (!assistantId) return [];

    const cached = assistantToolsCache.get(assistantId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) {
      return cached.tools;
    }

    try {
      const bindings = await prisma.assistantTool.findMany({
        where: {
          assistantId,
          enabled: true,
          tool: { status: "active" },
        },
        include: {
          tool: true,
        },
        orderBy: { createdAt: "asc" },
      });

    const tools = bindings
      .map((binding) => {
        const t = binding.tool;
        if (!t) return null;
        const def: any = t.definitionJson || {};
        const descriptionFromDef =
          typeof def.description === "string" && def.description.trim()
            ? def.description.trim()
            : "";
        const parameters =
          (def.parameters as ToolDefinition["parameters"]) || {
            type: "object",
            properties: {},
          };
        return {
          type: "function" as const,
          name: t.name,
          description: descriptionFromDef,
          parameters,
        };
      })
      .filter(Boolean) as {
      type: "function";
      name: string;
      description: string;
      parameters: NonNullable<ToolDefinition["parameters"]>;
    }[];

    assistantToolsCache.set(assistantId, {
      tools,
      expiresAt: now + TOOL_CACHE_TTL_MS,
    });

    return tools;
    } catch (err) {
      logger.error("tools.assistant.build_failed", {
        assistantId,
        error: (err as Error)?.message || String(err),
      });
      return [];
    }
  }

  async function handleToolCall(
    openAiSocket: SocketLike,
    clientSocket: SocketLike,
    toolCall: ToolCall,
    context?: { conversationId?: string | null; assistantId?: string | null }
  ) {
    const startedAt = performance.now();
    const toolCallId = toolCall?.id;
    const toolName = toolCall?.name;
    let args = {};
    try {
      args =
        typeof toolCall?.arguments === "string"
          ? JSON.parse(toolCall.arguments)
          : {};
    } catch (err) {
      logger.warn("tools.args.parse_failed", {
        tool: toolName,
        error: (err as Error)?.message || String(err),
      });
    }

    let outputPayload: any = {};
    const conversationId = context?.conversationId || null;
    let dbToolCallId: string | null = null;
    const toolMeta = toolName ? toolMap.get(toolName) : undefined;
    const displayName = toolMeta?.name || toolName || "unknown_tool";

    try {
      if (conversationId) {
        try {
          const created = await prisma.toolCall.create({
            data: {
              conversationId,
              toolId: toolMeta?.id,
              name: displayName,
              status: "started",
              inputJson: args,
            },
          });
          dbToolCallId = created.id;
        } catch (err) {
          logger.warn("tools.call.persist_start_failed", {
            tool: displayName,
            error: (err as Error)?.message || String(err),
          });
        }
      }

      sendToolLog(clientSocket, {
        name: displayName,
        status: "started",
        args,
      });

      if (!toolMeta) {
        outputPayload = { error: `Unknown tool: ${toolName}` };
      } else if (toolMeta.kind === "session") {
        outputPayload = await handleSessionToolCommand(
          openAiSocket,
          clientSocket,
          toolMeta,
          args
        );
      } else if (toolMeta.routes && externalApiConfig.baseUrl) {
        outputPayload = await callExternalApi(toolMeta.routes, args, externalApiConfig);
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
          logger.warn("tools.call.persist_fail_failed", {
            tool: displayName,
            error: (dbErr as Error)?.message || String(dbErr),
          });
        }
      }
    }

    const ok = !outputPayload.error;
    if (ok) {
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
          logger.warn("tools.call.persist_success_failed", {
            tool: displayName,
            error: (dbErr as Error)?.message || String(dbErr),
          });
        }
      }
    } else if (dbToolCallId) {
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
        logger.warn("tools.call.persist_error_payload_failed", {
          tool: displayName,
          error: (dbErr as Error)?.message || String(dbErr),
        });
      }
    }

    if (dbToolCallId && conversationId) {
      try {
        const last = await prisma.message.findFirst({
          where: { conversationId },
          orderBy: { sequence: "desc" },
        });
        const nextSequence = (last?.sequence ?? 0) + 1;
        const status = outputPayload.error ? "failed" : "succeeded";
        const finalName = toolMap.get(toolName || "")?.name || toolName || "unknown_tool";

        await prisma.message.create({
          data: {
            conversationId,
            from: "system",
            text: `Tool call ${finalName} (${status})`,
            sequence: nextSequence,
            toolCallId: dbToolCallId,
            meta: {
              turnType: "tool_call",
              toolName: finalName,
              toolStatus: status,
            },
          },
        });

        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });
      } catch (dbErr) {
        logger.warn("tools.call.persist_message_failed", {
          tool: displayName,
          error: (dbErr as Error)?.message || String(dbErr),
        });
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

    const durationMs = performance.now() - startedAt;
    metrics.recordToolResult({
      name: displayName,
      ok: !outputPayload.error,
      durationMs,
    });
  }

  return {
    loadToolsFromDatabase,
    buildOpenAIToolsForAssistant,
    handleToolCall,
  };
}

async function callExternalApi(
  route: NonNullable<ToolDefinition["routes"]>,
  args: Record<string, unknown>,
  externalApiConfig: ExternalApiConfig
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

  const res = await fetch(finalUrl, fetchOptions);
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
  const usedKeys = new Set<string>();
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

function sendToolLog(
  clientSocket: SocketLike,
  payload: {
    name?: string;
    status: string;
    args?: Record<string, unknown>;
    message?: string;
  }
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
    // eslint-disable-next-line no-console
    console.error("Failed to send tool log to client:", err);
  }
}

function sendUiCommand(
  clientSocket: SocketLike,
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
    // eslint-disable-next-line no-console
    console.error("Failed to send UI command to client:", err);
  }
}

async function handleSessionToolCommand(
  openAiSocket: SocketLike,
  clientSocket: SocketLike,
  toolMeta: ToolDefinition,
  args: Record<string, unknown>
) {
  const name = String(toolMeta.name || "unknown_session_tool");
  const uiCommand = toolMeta.ui_command || name;

  sendUiCommand(clientSocket, uiCommand, args || {});

  const sessionUpdate = toolMeta.session_update || {};
  if (sessionUpdate && typeof sessionUpdate === "object") {
    if (sessionUpdate.voiceParam) {
      const paramName = String(sessionUpdate.voiceParam);
      const voice =
        typeof args?.[paramName] === "string" && (args[paramName] as string).trim()
          ? (args[paramName] as string).trim()
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
          return { error: "Failed to update voice" };
        }
        return { status: "ok", voice };
      }
    }
  }

  return { status: "ok" };
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
