"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { VoiceMessage } from "@/hooks/useRealtimeSession";
import { ChatSummary, ChatSummaryMode } from "../components/Sidebar";
import { useApiConversations } from "@/hooks/useApiConversations";

type UseConversationActionsParams = {
  activeAssistantId: string | null;
  workspaceId: string | null;
  currentUserId: string | null;
  callStatus: "idle" | "calling" | "in_call";
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  setInput: (value: string) => void;
  setIsNewChatLayout: (value: boolean) => void;
  setActiveChatId: (id: string | null) => void;
  setActiveConversationId: (id: string | null) => void;
  setChats: React.Dispatch<React.SetStateAction<ChatSummary[]>>;
  persistedMessageIdsRef: React.MutableRefObject<Set<string>>;
  hydratedFromServerRef: React.MutableRefObject<boolean>;
};

export function useConversationActions({
  activeAssistantId,
  workspaceId,
  currentUserId,
  callStatus,
  setMessages,
  setInput,
  setIsNewChatLayout,
  setActiveChatId,
  setActiveConversationId,
  setChats,
  persistedMessageIdsRef,
  hydratedFromServerRef,
}: UseConversationActionsParams) {
  const router = useRouter();
  const {
    createConversation,
    archiveConversation,
    deleteConversation,
    renameConversation,
  } = useApiConversations();

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setInput("");
    setIsNewChatLayout(true);
    setActiveChatId(null);
    setActiveConversationId(null);
    persistedMessageIdsRef.current = new Set();
    hydratedFromServerRef.current = false;
    router.push("/");
  }, [
    router,
    setMessages,
    setInput,
    setIsNewChatLayout,
    setActiveChatId,
    setActiveConversationId,
    persistedMessageIdsRef,
    hydratedFromServerRef,
  ]);

  const handleSelectChat = useCallback(
    (id: string) => {
      setActiveChatId(id);
      setActiveConversationId(id);
      router.push(`/c/${id}`);
    },
    [router, setActiveChatId, setActiveConversationId]
  );

  const ensureConversationForMessage = useCallback(
    async (text: string): Promise<string | null> => {
      let conversationId: string | null = null;
      const trimmed = text.trim();
      if (!trimmed || !activeAssistantId || !workspaceId) return null;

      const mode: ChatSummaryMode =
        callStatus === "in_call" || callStatus === "calling" ? "voice" : "text";
      try {
        const conv = await createConversation({
          title: trimmed.slice(0, 30),
          mode,
          userId: currentUserId,
          assistantId: activeAssistantId,
          workspaceId,
        });
        if (conv?.id) {
          conversationId = conv.id as string;
          setActiveConversationId(conversationId);
          setActiveChatId(conversationId);
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
      return conversationId;
    },
    [
      activeAssistantId,
      workspaceId,
      callStatus,
      currentUserId,
      createConversation,
      setActiveConversationId,
      setActiveChatId,
      setChats,
    ]
  );

  const handleArchiveConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) return;
      try {
        await archiveConversation(conversationId);
      } catch (err) {
        console.error("Failed to archive conversation:", err);
      }
    },
    [archiveConversation]
  );

  const handleDeleteConversation = useCallback(
    async (conversationId: string | null) => {
      if (!conversationId) return;
      try {
        const ok = await deleteConversation(conversationId);
        if (!ok) return;
        setChats((prev) => prev.filter((chat) => chat.id !== conversationId));
        setMessages([]);
        setActiveChatId(null);
        setActiveConversationId(null);
        setIsNewChatLayout(true);
        router.push("/");
      } catch (err) {
        console.error("Failed to delete conversation:", err);
      }
    },
    [
      deleteConversation,
      router,
      setChats,
      setMessages,
      setActiveChatId,
      setActiveConversationId,
      setIsNewChatLayout,
    ]
  );

  const handleArchiveChat = useCallback(async (conversationId: string) => {
    try {
      await archiveConversation(conversationId);
    } catch (err) {
      console.error("Failed to archive chat from sidebar:", err);
    }
  }, [archiveConversation]);

  const handleRenameChat = useCallback(
    async (conversationId: string, nextTitle: string) => {
      try {
        const ok = await renameConversation(conversationId, nextTitle);
        if (!ok) return;
        const trimmed = nextTitle.trim();
        setChats((prev) =>
          prev.map((chatItem) =>
            chatItem.id === conversationId
              ? { ...chatItem, title: trimmed }
              : chatItem
          )
        );
      } catch (err) {
        console.error("Failed to rename chat:", err);
      }
    },
    [renameConversation, setChats]
  );

  return {
    handleNewChat,
    handleSelectChat,
    ensureConversationForMessage,
    handleArchiveConversation,
    handleDeleteConversation,
    handleArchiveChat,
    handleRenameChat,
  };
}
