"use client";

type VoiceMessage = {
  id?: string;
  from: "assistant" | "system" | "user";
  text: string;
  meta?: Record<string, unknown> | string | null;
};

export type HydrationStatus = "ok" | "not_found" | "error" | "invalid" | "timeout";

type HydrationParams = {
  initialChatId: string;
  t: (key: string) => string;
  fetchConversation: (
    id: string,
    init?: RequestInit
  ) => Promise<{ ok: boolean; status: number; data: any }>;
  storage?: Pick<Storage, "setItem" | "getItem" | "removeItem">;
  onPushHome: () => void;
  onSetMessages: (messages: VoiceMessage[]) => void;
  onSetConversationId: (id: string) => void;
  onSetChatId: (id: string) => void;
  onSetIsNewChatLayout: (value: boolean) => void;
  timeoutMs?: number;
};

export async function hydrateConversationOnce({
  initialChatId,
  t,
  fetchConversation,
  storage,
  onPushHome,
  onSetMessages,
  onSetConversationId,
  onSetChatId,
  onSetIsNewChatLayout,
  timeoutMs = 10000,
}: HydrationParams): Promise<HydrationStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const { ok, status, messages } = await fetchConversation(initialChatId, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!ok) {
      if (status === 404) {
        try {
          const template = t("chat.toast.unableToLoadConversation");
          const msg = template.replace("{id}", initialChatId);
          storage?.setItem("va-toast", msg);
        } catch {
          // ignore storage errors
        }
        onPushHome();
        return "not_found";
      }
      return "error";
    }

    if (!messages || !Array.isArray(messages)) {
      return "invalid";
    }

    const nextMessages: VoiceMessage[] = messages.map(
      (m: {
        id?: string;
        from?: string;
        text?: string;
        meta?: unknown;
        meta_json?: unknown;
        metaJson?: unknown;
      }): VoiceMessage => {
        const rawMeta = m.meta ?? m.meta_json ?? m.metaJson ?? null;
        let parsedMeta: Record<string, unknown> | string | null = null;

        if (typeof rawMeta === "string") {
          try {
            const asObj = JSON.parse(rawMeta);
            parsedMeta =
              asObj && typeof asObj === "object" ? (asObj as Record<string, unknown>) : rawMeta;
          } catch {
            parsedMeta = rawMeta;
          }
        } else if (rawMeta && typeof rawMeta === "object") {
          parsedMeta = rawMeta as Record<string, unknown>;
        }

        return {
          id: m.id as string,
          from:
            m.from === "assistant"
              ? "assistant"
              : m.from === "system"
              ? "system"
              : "user",
          text: typeof m.text === "string" ? m.text : "",
          meta: parsedMeta,
        };
      }
    );

    onSetMessages(nextMessages);
    onSetConversationId(initialChatId);
    onSetChatId(initialChatId);
    onSetIsNewChatLayout(false);

    return "ok";
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return "timeout";
    }
    return "error";
  } finally {
    clearTimeout(timeoutId);
  }
}
