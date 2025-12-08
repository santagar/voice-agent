"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { VoiceMessage } from "@/hooks/useRealtimeSession";
import { hydrateConversationOnce } from "./conversationHydrationHelpers";
import { useApiConversations } from "@/hooks/useApiConversations";

type ConversationHydrationResult = {
  conversationHydrated: boolean;
  conversationLoadError: string | null;
  hydratedFromServerRef: React.MutableRefObject<boolean>;
  hydratedFromServer: boolean;
};

export function useConversationHydration(
  initialChatId: string | null,
  t: (key: string) => string,
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>,
  setActiveConversationId: (id: string | null) => void,
  setActiveChatId: (id: string | null) => void,
  setIsNewChatLayout: (value: boolean) => void,
  initialMessages?: VoiceMessage[] | null
): ConversationHydrationResult {
  const router = useRouter();
  const { getConversationById } = useApiConversations();
  const hydratedFromServerRef = useRef(false);
  const initialHydrated = !initialChatId;
  const [conversationHydrated, setConversationHydrated] = useState(initialHydrated);
  const [conversationLoadError, setConversationLoadError] = useState<string | null>(null);
  const [hydratedFromServer, setHydratedFromServer] = useState(false);

  useEffect(() => {
    if (!initialChatId) return;

    // If the server already provided messages, hydrate immediately to avoid flash.
    if (Array.isArray(initialMessages)) {
      setMessages(initialMessages);
      setActiveConversationId(initialChatId);
      setActiveChatId(initialChatId);
      setIsNewChatLayout(false);
      hydratedFromServerRef.current = true;
      setHydratedFromServer(true);
      setConversationHydrated(true);
      return;
    }

    if (hydratedFromServerRef.current) return;

    // If the server already provided messages, hydrate from them immediately
    // to avoid a visible fetch flash.
    if (initialMessages && initialMessages.length >= 0) {
      setMessages(initialMessages);
      setActiveConversationId(initialChatId);
      setActiveChatId(initialChatId);
      setIsNewChatLayout(false);
      hydratedFromServerRef.current = true;
      setHydratedFromServer(true);
      setConversationHydrated(true);
      return;
    }

    let cancelled = false;

    async function loadConversation() {
      try {
        setConversationLoadError(null);

        const status = await hydrateConversationOnce({
          initialChatId,
          t,
          fetchConversation: getConversationById,
          storage:
            typeof window !== "undefined" ? window.sessionStorage : undefined,
          onPushHome: () => router.push("/"),
          onSetMessages: setMessages,
          onSetConversationId: (id) => setActiveConversationId(id),
          onSetChatId: (id) => setActiveChatId(id),
          onSetIsNewChatLayout: setIsNewChatLayout,
        });

        if (cancelled) return;

        hydratedFromServerRef.current = status === "ok";
        setHydratedFromServer(status === "ok");
        setConversationHydrated(true);

        if (status === "not_found") {
          setConversationLoadError("not_found");
        } else if (status === "invalid" || status === "error") {
          setConversationLoadError("error");
        } else if (status === "timeout") {
          setConversationLoadError("timeout");
        }
      } catch (err) {
        console.error("Failed to hydrate conversation from server:", err);
        if (!cancelled) {
          setConversationLoadError("timeout");
          setConversationHydrated(true);
        }
      }
    }

    void loadConversation();

    return () => {
      cancelled = true;
    };
  }, [
    initialChatId,
    initialMessages,
    setMessages,
    t,
    setActiveConversationId,
    setActiveChatId,
    setIsNewChatLayout,
    router,
  ]);

  return {
    conversationHydrated,
    conversationLoadError,
    hydratedFromServerRef,
    hydratedFromServer,
  };
}
