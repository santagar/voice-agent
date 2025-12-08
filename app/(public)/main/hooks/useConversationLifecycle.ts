"use client";

import { useEffect, useMemo, useState } from "react";
import { VoiceMessage } from "@/hooks/useRealtimeSession";
import { ChatSummary, ChatSummaryMode } from "../components/Sidebar";
import { useApiConversations } from "@/hooks/useApiConversations";

type UseConversationLifecycleParams = {
  callStatus: "idle" | "calling" | "in_call";
  activeAssistantId: string | null;
  workspaceId: string | null;
  currentUserId: string | null;
  activeConversationId: string | null;
  visibleMessages: VoiceMessage[];
  setActiveConversationId: (id: string | null) => void;
  setActiveChatId: (id: string | null) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
};

export function useConversationLifecycle({
  callStatus,
  activeAssistantId,
  workspaceId,
  currentUserId,
  activeConversationId,
  visibleMessages,
  setActiveConversationId,
  setActiveChatId,
  setChats,
}: UseConversationLifecycleParams) {
  const { createConversation } = useApiConversations();
  const callActive = callStatus === "calling" || callStatus === "in_call";
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);

  useEffect(() => {
    if (activeConversationId) return;
    if (!activeAssistantId || !workspaceId) return;

    const userOrAssistantMessages = visibleMessages.filter(
      (m) => (m.from === "user" || m.from === "assistant") && m.text.trim()
    );
    if (userOrAssistantMessages.length === 0) return;

    const mode: ChatSummaryMode =
      callStatus === "in_call" || callStatus === "calling" ? "voice" : "text";

    void (async () => {
      try {
        const conv = await createConversation({
          title: "New voice chat",
          mode,
          userId: currentUserId,
          assistantId: activeAssistantId,
          workspaceId,
        });
        if (conv?.id) {
          setActiveConversationId(conv.id as string);
          setActiveChatId(conv.id as string);
          setChats((prev) => [
            {
              id: conv.id as string,
              title: conv.title as string,
              mode: (conv.mode as ChatSummaryMode) ?? "unknown",
              createdAt: conv.createdAt as string,
              updatedAt: conv.updatedAt as string,
              lastMessageFrom: null,
              lastMessageAt: null,
            },
            ...prev,
          ]);
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
      }
    })();
  }, [
    activeConversationId,
    activeAssistantId,
    callStatus,
    currentUserId,
    visibleMessages,
    workspaceId,
    setActiveChatId,
    setActiveConversationId,
    setChats,
    createConversation,
  ]);

  useEffect(() => {
    if (callActive && !callStartedAt) {
      const id = window.setTimeout(() => setCallStartedAt(Date.now()), 0);
      return () => window.clearTimeout(id);
    }
    if (!callActive) {
      const id = window.setTimeout(() => {
        setCallStartedAt(null);
        setCallElapsedSeconds(0);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [callActive, callStartedAt]);

  useEffect(() => {
    if (!callStartedAt || !callActive) return;
    const id = window.setInterval(() => {
      setCallElapsedSeconds(Math.floor((Date.now() - callStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [callStartedAt, callActive]);

  const callTimerLabel = useMemo(() => {
    const total = callElapsedSeconds;
    const minutes = Math.floor(total / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (total % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [callElapsedSeconds]);

  return { callActive, callTimerLabel };
}
