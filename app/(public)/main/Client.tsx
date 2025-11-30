"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  AudioLines,
  Archive,
  Bug,
  Copy,
  Ellipsis,
  CircleQuestionMark,
  Captions,
  HelpCircle,
  LogOut,
  Menu,
  ArrowDown,
  Mic,
  MicOff,
  Moon,
  Phone,
  PanelLeft,
  Settings,
  Sun,
  User,
  UserCircle2,
  UserPlus,
  Volume2,
  VolumeX,
  Wand2,
  X,
  MessageCircle,
  MessageCircleOff,
  TextCursorInput,
  Trash2,
} from "lucide-react";
import { ChatBubble } from "@/components/front/ui/ChatBubble";
import { MarkdownMessage } from "@/components/front/ui/MarkdownMessage";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { labTheme } from "@/lib/theme";
import { useTheme } from "@/components/theme/ThemeContext";
import { useLocale } from "@/components/locale/LocaleContext";
import {
  useRealtimeVoiceSession,
  VoiceMessage,
} from "@/lib/voice/useRealtimeVoiceSession";
import { SettingsDialog } from "@/components/front/settings/SettingsDialog";
import { IconButton } from "@/components/front/ui/IconButton";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { signOut } from "next-auth/react";
import { ChatTextInput } from "@/components/front/chat/ChatTextInput";
import { useRouter } from "next/navigation";
import {
  Sidebar,
  ChatSummary,
  ChatSummaryMode,
} from "./components/Sidebar";
import { ChatHeader, AssistantSummary } from "./components/Header";
import { ConfirmDialog } from "@/components/front/ui/ConfirmDialog";

const START_CALL_PROMPT =
  "Arranca una conversación de voz amable y breve en español. Presentate y pregunta en qué puedes ayudar.";

type ChatClientProps = {
  initialSidebarCollapsed: boolean;
  initialLoggedIn?: boolean;
  initialUserEmail?: string | null;
  initialChatId?: string | null;
  initialUserName?: string | null;
  initialUserImage?: string | null;
  currentUserId?: string | null;
  workspaceId?: string | null;
  assistantId?: string | null;
  initialChats?: ChatSummary[] | null;
  initialAssistants?: AssistantSummary[] | null;
};

export default function ChatClientPage({
  initialSidebarCollapsed,
  initialLoggedIn = false,
  initialUserEmail = null,
  initialChatId = null,
  initialUserName = null,
  initialUserImage = null,
  currentUserId = null,
  workspaceId = null,
  assistantId = null,
  initialChats = null,
  initialAssistants = null,
}: ChatClientProps) {
  const {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    wsConnected,
    callStatus,
    inCall,
    assistantTalking,
    isRecording,
    muted,
    micMuted,
    currentScope,
    startCall,
    endCall,
    toggleSpeaker: voiceToggleSpeaker,
    toggleMic: voiceToggleMic,
    sendUserMessage,
  } = useRealtimeVoiceSession({
    startCallPrompt: START_CALL_PROMPT,
    initialScope: "support",
    onAssistantTurnFinal: (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      let conversationId = activeConversationId;

      // If for some reason we don't yet have a conversation (e.g. pure
      // voice greeting), create one now so the assistant turn is not
      // lost.
      if (!conversationId && activeAssistantId && workspaceId) {
        void (async () => {
          try {
            const mode =
              callStatus === "in_call" || callStatus === "calling"
                ? "voice"
                : "text";
            const res = await fetch("/api/conversations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: "New chat",
                mode,
                userId: currentUserId,
                assistantId: activeAssistantId,
                workspaceId,
              }),
            });
            if (!res.ok) return;
            const data = await res.json();
            const conv = data.conversation;
            if (conv?.id) {
              const id = conv.id as string;
              setActiveConversationId(id);
              setChats((prev) => [
                {
                  id,
                  title: conv.title as string,
                  mode: (conv.mode as ChatSummaryMode) ?? "unknown",
                  createdAt: conv.createdAt as string,
                  updatedAt: conv.updatedAt as string,
                  lastMessageFrom: null,
                  lastMessageAt: null,
                },
                ...prev,
              ]);
              conversationId = id;
            }
          } catch (err) {
            console.error("Failed to create conversation for assistant:", err);
          }
        })();
      }

      if (!conversationId) return;

      void fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "assistant",
          text: trimmed,
          meta: {
            turnType:
              callStatus === "in_call" || callStatus === "calling"
                ? "assistant_voice"
                : "assistant_text",
            scope: currentScope,
            inputMode: null,
            outputMode:
              callStatus === "in_call" || callStatus === "calling"
                ? "voice"
                : "text",
            bargeIn: false,
          },
        }),
      }).catch((err) => {
        console.error("Failed to persist assistant message:", err);
      });
    },
  });

  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showInputDuringCall, setShowInputDuringCall] = useState(false);
  const [showAssistantText, setShowAssistantText] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    initialSidebarCollapsed
  );
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showHeaderDivider, setShowHeaderDivider] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [debugConfig, setDebugConfig] = useState<{
    profile?: any;
    tools?: any;
    sanitize?: any;
  } | null>(null);
  const [debugLoading, setDebugLoading] = useState(false);
  const [debugError, setDebugError] = useState<string | null>(null);
  const [debugOffset, setDebugOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [debugSize, setDebugSize] = useState<{ width: number; height: number }>(
    { width: 320, height: 260 }
  );
  const debugDraggingRef = useRef(false);
  const debugDragStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const debugOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const debugResizingRef = useRef(false);
  const debugResizeStartRef = useRef<{
    mouseX: number;
    mouseY: number;
    width: number;
    height: number;
  } | null>(null);
  const debugSizeRef = useRef<{ width: number; height: number }>({
    width: 320,
    height: 260,
  });
  const [configExpanded, setConfigExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(true);
  const [loggedIn, setLoggedIn] = useState(initialLoggedIn);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(initialUserEmail);
  const [userName, setUserName] = useState<string | null>(initialUserName);
  const [userImage, setUserImage] = useState<string | null>(initialUserImage);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [chats, setChats] = useState<ChatSummary[]>(initialChats ?? []);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const router = useRouter();
  const isAdminUser = userEmail === "santagar@gmail.com";
  const [isNewChatLayout, setIsNewChatLayout] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "info";
  } | null>(null);
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const { locale, setLocale, t } = useLocale();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastMessageIdRef = useRef<string | null>(null);
  // Used to avoid re-persisting the same assistant snapshot multiple times.
  const persistedMessageIdsRef = useRef<Set<string>>(new Set());
  const hydratedFromServerRef = useRef(false);
  const [conversationHydrated, setConversationHydrated] = useState(
    !initialChatId
  );
  const [conversationLoadError, setConversationLoadError] = useState<
    string | null
  >(null);
  const hasTypedInput = input.trim().length > 0;
  const initialAssistantList: AssistantSummary[] =
    initialAssistants && initialAssistants.length
      ? initialAssistants
      : assistantId
      ? [{ id: assistantId, name: "Voice Agent" }]
      : [];
  const [assistants] = useState<AssistantSummary[]>(initialAssistantList);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(
    assistantId && initialAssistantList.some((a) => a.id === assistantId)
      ? assistantId
      : initialAssistantList[0]?.id ?? null
  );
  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  // If a voice call is closed without any user/assistant messages,
  // return to the initial "new chat" hero instead of leaving an
  // empty conversation layout.
  const resetToNewChatIfEmpty = useCallback(() => {
    const hasUserOrAssistant = messages.some(
      (m) => m.from === "user" || m.from === "assistant"
    );
    if (!hasUserOrAssistant) {
      setMessages([]);
      setIsNewChatLayout(true);
      setActiveChatId(null);
    }
  }, [messages, setMessages]);

  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callElapsedSeconds, setCallElapsedSeconds] = useState(0);

  const setSidebarCollapsedAndPersist = useCallback(
    (next: boolean) => {
      setSidebarCollapsed(next);
      try {
        document.cookie = `va-sidebar-collapsed=${
          next ? "true" : "false"
        }; path=/; max-age=31536000`;
      } catch {
        // Best-effort only; if cookies are disabled we still update local state.
      }
    },
    []
  );

  function speak(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    // Only replay using the assistant's own Realtime voice
    // when there is an active voice call.
    if (callStatus !== "in_call") {
      return;
    }
    const prompt = `Repite exactamente este mensaje en voz usando tu propia voz, sin añadir nada más:\n\n${trimmed}`;
    void sendUserMessage(prompt, {
      silent: true,
      conversationId: activeConversationId,
      assistantId: activeAssistantId ?? undefined,
    });
  }

  function scrollToBottom() {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }

  function toggleSpeaker() {
    voiceToggleSpeaker();
  }

  function toggleMic() {
    voiceToggleMic();
  }

  function handleStartCall() {
    setShowInputDuringCall(false);
    setIsNewChatLayout(false);
    startCall();
  }

  async function handleSendText() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setIsNewChatLayout(false);

    let conversationId = activeConversationId;

    // For text-only flows, ensure we have a Conversation as soon as the
    // user sends the first message.
    if (!conversationId && activeAssistantId && workspaceId) {
      try {
        const mode =
          callStatus === "in_call" || callStatus === "calling"
            ? "voice"
            : "text";
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New chat",
            mode,
            userId: currentUserId,
            assistantId: activeAssistantId,
            workspaceId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          const conv = data.conversation;
          if (conv?.id) {
            conversationId = conv.id as string;
            setActiveConversationId(conversationId);
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
        }
      } catch (err) {
        console.error("Failed to create conversation:", err);
      }
    }

    setInput("");
    void sendUserMessage(trimmed, {
      conversationId,
      assistantId: activeAssistantId ?? undefined,
    });

    // Persist the user's message immediately if we have a conversation id.
    if (conversationId) {
      void fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "user",
          text: trimmed,
          meta: {
            turnType: "user_text",
            scope: currentScope,
            inputMode: "keyboard",
            outputMode:
              callStatus === "in_call" || callStatus === "calling"
                ? "voice"
                : "text",
            bargeIn: false,
          },
        }),
      }).catch((err) => {
        console.error("Failed to persist user message:", err);
      });
    }
  }

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.from !== "system"),
    [messages]
  );

  const debugEvents = useMemo(
    () => messages.filter((m) => m.from === "system"),
    [messages]
  );

  const callActive =
    callStatus === "calling" || callStatus === "in_call";
  const shouldShowInput = !callActive || showInputDuringCall;

  // Ensure a Conversation exists once there is a first real message
  // (user or assistant) in the current session.
  useEffect(() => {
    if (activeConversationId) return;
    if (!activeAssistantId || !workspaceId) return;

    const userOrAssistantMessages = visibleMessages.filter(
      (m) => (m.from === "user" || m.from === "assistant") && m.text.trim()
    );
    if (userOrAssistantMessages.length === 0) return;

    const mode =
      callStatus === "in_call" || callStatus === "calling" ? "voice" : "text";

    void (async () => {
      try {
        const res = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "New chat",
            mode,
            userId: currentUserId,
            assistantId: activeAssistantId,
            workspaceId,
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        const conv = data.conversation;
        if (conv?.id) {
          setActiveConversationId(conv.id as string);
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
    assistantId,
    callStatus,
    currentUserId,
    visibleMessages,
    workspaceId,
  ]);

  // Load chat summaries from the backend on first mount.
  useEffect(() => {
    let cancelled = false;
    async function loadChats() {
      try {
        const res = await fetch("/api/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data.conversations)) return;
        if (cancelled) return;
        const summaries: ChatSummary[] = data.conversations.map((c: any) => ({
          id: c.id,
          title: c.title,
          mode: c.mode ?? "unknown",
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
          lastMessageFrom: null,
          lastMessageAt: c.lastMessageAt,
        }));
        setChats(summaries);
      } catch (err) {
        console.error("Failed to load chats:", err);
      }
    }
    void loadChats();
    return () => {
      cancelled = true;
    };
  }, []);

  // When arriving on /c/[chatId], hydrate the message list from
  // the backend conversation history so the user sees previous
  // turns instead of an empty state.
  useEffect(() => {
    if (!initialChatId) return;
    if (hydratedFromServerRef.current) return;

    let cancelled = false;

    async function loadConversation() {
      try {
        setConversationLoadError(null);

        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => {
          controller.abort();
        }, 10000);

        const res = await fetch(`/api/conversations/${initialChatId}`, {
          signal: controller.signal,
        }).finally(() => {
          window.clearTimeout(timeoutId);
        });

        if (!res.ok) {
          if (!cancelled) {
            if (res.status === 404) {
              setConversationLoadError("not_found");
              try {
                const template = t("chat.toast.unableToLoadConversation");
                const id = initialChatId ?? "";
                const msg = template.replace("{id}", id);
                window.sessionStorage.setItem("va-toast", msg);
              } catch {
                // ignore storage errors
              }
              setConversationHydrated(true);
              router.push("/");
            } else {
              setConversationLoadError("error");
              setConversationHydrated(true);
            }
          }
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data.messages)) {
          if (!cancelled) {
            setConversationLoadError("error");
            setConversationHydrated(true);
          }
          return;
        }
        if (cancelled) return;

        const nextMessages: VoiceMessage[] = data.messages.map(
          (m: any): VoiceMessage => ({
            id: m.id as string,
            from:
              m.from === "assistant"
                ? "assistant"
                : m.from === "system"
                ? "system"
                : "user",
            text: typeof m.text === "string" ? m.text : "",
          })
        );

        setMessages(nextMessages);
        setActiveConversationId(initialChatId);
        setActiveChatId(initialChatId);
        setIsNewChatLayout(false);
        hydratedFromServerRef.current = true;
        setConversationHydrated(true);
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
  }, [initialChatId, setMessages, router, t]);

  // Helper to derive a simple human-readable title from the first
  // meaningful message in a conversation.
  const deriveTitleFromText = useCallback(
    (text: string): string => {
      const trimmed = text.trim().replace(/\s+/g, " ");
      if (!trimmed) return t("chat.sidebar.newChat");
      const maxLen = 60;
      if (trimmed.length <= maxLen) return trimmed;
      return trimmed.slice(0, maxLen).trimEnd() + "…";
    },
    [t]
  );

  // NOTE: For now we only persist user messages from the client.
  // Assistant messages are streamed token-by-token, so capturing a
  // single, stable snapshot is better done from the Realtime bridge
  // once the final transcript is known.

  // Track call duration for active voice sessions.
  useEffect(() => {
    if (callActive && !callStartedAt) {
      setCallStartedAt(Date.now());
    }
    if (!callActive) {
      setCallStartedAt(null);
      setCallElapsedSeconds(0);
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

  const handleArchiveConversation = useCallback(async () => {
    if (!activeConversationId) return;
    try {
      const res = await fetch(`/api/conversations/${activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive" }),
      });
      if (!res.ok) return;
      // We don't yet surface archived state in the UI; this is a
      // lightweight server-side toggle so future listings can hide it.
    } catch (err) {
      console.error("Failed to archive conversation:", err);
    } finally {
      setShowMenu(false);
    }
  }, [activeConversationId]);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const handleDeleteConversation = useCallback(async () => {
    if (!pendingDeleteId) return;
    try {
      const res = await fetch(`/api/conversations/${pendingDeleteId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) return;
      setChats((prev) =>
        prev.filter((chat) => chat.id !== pendingDeleteId)
      );
      if (pendingDeleteId === activeConversationId) {
        setMessages([]);
        setActiveChatId(null);
        setActiveConversationId(null);
        setIsNewChatLayout(true);
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    } finally {
      setShowMenu(false);
      setShowDeleteDialog(false);
    }
  }, [activeConversationId, pendingDeleteId, router, setChats, setMessages]);

  const handleArchiveChat = useCallback(
    async (conversationId: string) => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "archive" }),
        });
        if (!res.ok) return;
        // For now we don't change the visual state; archived conversations
        // can still appear in the list until a future filter is added.
      } catch (err) {
        console.error("Failed to archive chat from sidebar:", err);
      }
    },
    []
  );

  const handleRenameChat = useCallback(
    async (conversationId: string, nextTitle: string) => {
      const chat = chats.find((c) => c.id === conversationId);
      const currentTitle = chat?.title ?? "";
      const trimmed = nextTitle.trim();
      if (!trimmed || trimmed === currentTitle) return;
      try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "rename", title: trimmed }),
        });
        if (!res.ok) return;
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
    [chats, t]
  );

  useEffect(() => {
    debugOffsetRef.current = debugOffset;
  }, [debugOffset]);

  useEffect(() => {
    debugSizeRef.current = debugSize;
  }, [debugSize]);

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (debugDraggingRef.current && debugDragStartRef.current) {
        const { mouseX, mouseY, offsetX, offsetY } = debugDragStartRef.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const next = { x: offsetX + dx, y: offsetY + dy };
        debugOffsetRef.current = next;
        setDebugOffset(next);
      } else if (debugResizingRef.current && debugResizeStartRef.current) {
        const { mouseX, mouseY, width, height } = debugResizeStartRef.current;
        const dx = e.clientX - mouseX;
        const dy = e.clientY - mouseY;
        const nextWidth = Math.max(320, width + dx);
        const nextHeight = Math.max(260, height + dy);
        const nextSize = { width: nextWidth, height: nextHeight };
        debugSizeRef.current = nextSize;
        setDebugSize(nextSize);
      }
    }

    function handleMouseUp() {
      debugDraggingRef.current = false;
      debugDragStartRef.current = null;
      debugResizingRef.current = false;
      debugResizeStartRef.current = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined"
        ? window.sessionStorage.getItem("va-toast")
        : null;
      if (stored) {
        setToast({ message: stored, tone: "error" });
        window.sessionStorage.removeItem("va-toast");
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  function handleDebugDragStart(e: React.MouseEvent) {
    e.preventDefault();
    const current = debugOffsetRef.current;
    debugDraggingRef.current = true;
    debugDragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      offsetX: current.x,
      offsetY: current.y,
    };
  }

  function handleDebugResizeStart(e: React.MouseEvent) {
    e.preventDefault();
    const current = debugSizeRef.current;
    debugResizingRef.current = true;
    debugResizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      width: current.width,
      height: current.height,
    };
  }

  useEffect(() => {
    if (!showDebug) return;
    if (debugConfig) return;
    let cancelled = false;
    setDebugLoading(true);
    setDebugError(null);

    async function loadDebugConfig() {
      try {
        const [profileRes, toolsRes, sanitizeRes] = await Promise.all([
          fetch("/api/config/profile"),
          fetch("/api/config/tools"),
          fetch("/api/config/sanitize"),
        ]);
        if (cancelled) return;
        if (!profileRes.ok || !toolsRes.ok || !sanitizeRes.ok) {
          throw new Error("Failed to load debug configuration");
        }
        const [profileJson, toolsJson, sanitizeJson] = await Promise.all([
          profileRes.json(),
          toolsRes.json(),
          sanitizeRes.json(),
        ]);
        setDebugConfig({
          profile: profileJson.profile,
          tools: toolsJson.tools,
          sanitize: sanitizeJson.sanitize,
        });
      } catch (err: any) {
        if (cancelled) return;
        setDebugError(err?.message || "Unknown error loading debug config");
      } finally {
        if (!cancelled) {
          setDebugLoading(false);
        }
      }
    }

    void loadDebugConfig();

    return () => {
      cancelled = true;
    };
  }, [showDebug, debugConfig]);

  useEffect(() => {
    scrollToBottom();
    const chatEl = chatRef.current;
    if (!chatEl) return;
    const updateHeaderDivider = () => {
      const canScroll = chatEl.scrollHeight > chatEl.clientHeight;
      const scrollTop = chatEl.scrollTop;
      const nearTop = scrollTop <= 0;
      const nearBottom =
        chatEl.scrollHeight - (scrollTop + chatEl.clientHeight) < 8;

      setShowHeaderDivider(canScroll && !nearTop);
      setShowScrollDown(canScroll && !nearBottom);
    };
    updateHeaderDivider();
    chatEl.addEventListener("scroll", updateHeaderDivider);
    return () => {
      chatEl.removeEventListener("scroll", updateHeaderDivider);
    };
  }, [messages]);

  // Global keyboard shortcuts (New chat, Search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // ⇧ ⌘ O → New chat
      if (key === "o" && e.shiftKey) {
        e.preventDefault();
        setMessages([]);
        setInput("");
        return;
      }

      // ⌘ K → focus search / input
      if (key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setMessages, setInput]);

  return (
    <main
      className={`min-h-screen overflow-hidden ${
        isDark
          ? "bg-neutral-800 text-slate-100"
          : "bg-white text-slate-900"
      }`}
    >
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar (md and up) */}
         <aside
          className={`relative hidden h-full flex-col border-r backdrop-blur-xl md:flex ${
            isDark
              ? sidebarCollapsed
                ? "border-white/5 bg-neutral-800/80"
                : "border-white/5 bg-neutral-900"
              : sidebarCollapsed
              ? "border-zinc-200/60 bg-white/70"
              : "border-zinc-200/60 bg-zinc-50"
          }`}
          style={{ width: sidebarCollapsed ? 52 : 260 }}
        >
          <Sidebar
            isDark={isDark}
            sidebarCollapsed={sidebarCollapsed}
            showMobileSidebar={false}
            chats={chats}
            activeChatId={activeChatId}
            loggedIn={loggedIn}
            userEmail={userEmail}
            userName={userName}
            userImage={userImage}
            isAdminUser={isAdminUser}
            t={t}
            onToggleSidebarCollapse={() =>
              setSidebarCollapsedAndPersist(!sidebarCollapsed)
            }
            onNewChat={() => {
              setMessages([]);
              setInput("");
              setIsNewChatLayout(true);
              setActiveChatId(null);
              setActiveConversationId(null);
              persistedMessageIdsRef.current = new Set();
              router.push("/");
            }}
            onSelectChat={(id) => {
              setActiveChatId(id);
              setActiveConversationId(id);
              router.push(`/c/${id}`);
            }}
            onOpenSettings={() => setShowSettingsDialog(true)}
            onOpenPlatform={() => {
              router.push("/platform");
              setShowUserMenu(false);
            }}
            onToggleUserMenu={() => setShowUserMenu((prev) => !prev)}
            showUserMenu={showUserMenu}
            onArchiveChat={handleArchiveChat}
            onDeleteChat={(id) => {
              setPendingDeleteId(id);
              setShowDeleteDialog(true);
            }}
            onRenameChat={handleRenameChat}
          />
        </aside>

        {/* Mobile sidebar curtain (below md) */}
        {showMobileSidebar && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/50 md:hidden"
              onClick={() => setShowMobileSidebar(false)}
              aria-hidden
            />
            <aside
              className={`fixed inset-y-0 left-0 z-40 flex h-full w-[60vw] max-w-sm flex-col border-r shadow-2xl backdrop-blur-xl md:hidden ${
                isDark
                  ? "border-white/5 bg-neutral-800/90"
                  : "border-zinc-200/60 bg-white"
              }`}
            >
              <Sidebar
                isDark={isDark}
                sidebarCollapsed={false}
                showMobileSidebar={true}
                chats={chats}
                activeChatId={activeChatId}
                loggedIn={loggedIn}
                userEmail={userEmail}
                userName={userName}
                userImage={userImage}
                isAdminUser={isAdminUser}
                t={t}
                onToggleSidebarCollapse={() => undefined}
                onNewChat={() => {
                  setMessages([]);
                  setInput("");
                  setIsNewChatLayout(true);
                  setActiveChatId(null);
                  setActiveConversationId(null);
                  persistedMessageIdsRef.current = new Set();
                  router.push("/");
                }}
                onSelectChat={(id) => {
                  setActiveChatId(id);
                  setActiveConversationId(id);
                  setShowMobileSidebar(false);
                  router.push(`/c/${id}`);
                }}
                onOpenSettings={() => setShowSettingsDialog(true)}
                onOpenPlatform={() => {
                  router.push("/platform");
                  setShowUserMenu(false);
                }}
                onToggleUserMenu={() => setShowUserMenu((prev) => !prev)}
                showUserMenu={showUserMenu}
                onCloseMobileSidebar={() => setShowMobileSidebar(false)}
                onArchiveChat={handleArchiveChat}
                onDeleteChat={(id) => {
                  setPendingDeleteId(id);
                  setShowDeleteDialog(true);
                }}
                onRenameChat={handleRenameChat}
              />
            </aside>
          </>
        )}

        {loggedIn && showUserMenu && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setShowUserMenu(false)}
              aria-hidden
            />
            <div
              className={`fixed bottom-20 left-4 z-50 w-72 rounded-3xl border shadow-lg backdrop-blur-sm ${
                isDark
                  ? "border-white/10 bg-neutral-900/95"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 overflow-hidden">
                      {userImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={userImage}
                          alt={userName || userEmail || "User avatar"}
                          className="h-full w-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <UserCircle2 className="h-5 w-5" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span
                        className={`truncate text-sm font-medium ${
                          isDark ? "text-gray-100" : "text-gray-900"
                        }`}
                      >
                        {userName || userEmail || t("chat.profile.email")}
                      </span>
                      {userName && userEmail && (
                        <span
                          className={`truncate text-xs ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          {userEmail}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isDark
                        ? "text-gray-300 hover:bg-white/10"
                        : "text-gray-500 hover:bg-zinc-100"
                    }`}
                  >
                    +
                  </button>
                </div>
                {isAdminUser && (
                  <button
                    type="button"
                    onClick={() => {
                      router.push("/platform");
                      setShowUserMenu(false);
                    }}
                    className={`mt-3 flex w-full items-center justify-between rounded-2xl px-3 py-2 ${
                      isDark
                        ? "bg-sky-500/20 hover:bg-sky-500/30 cursor-pointer"
                        : "bg-sky-500/10 hover:bg-sky-500/20 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white">
                        A
                      </span>
                      <span className="text-xs font-medium text-gray-900 dark:text-gray-50">
                        {t("chat.userMenu.adminAccount")}
                      </span>
                    </div>
                  </button>
                )}
              </div>
              <div
                className={`my-1 border-t ${
                  isDark ? "border-white/10" : "border-zinc-200"
                }`}
              />
              <div className="py-1 px-2 text-xs">
                <button
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <UserPlus className="h-4 w-4" />
                  <span>{t("chat.userMenu.addTeammates")}</span>
                </button>
                <button
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <PanelLeft className="h-4 w-4" />
                  <span>{t("chat.userMenu.workspaceSettings")}</span>
                </button>
                <button
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <Wand2 className="h-4 w-4" />
                  <span>{t("chat.userMenu.personalization")}</span>
                </button>
                <button
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <Settings className="h-4 w-4" />
                  <span>{t("chat.userMenu.settings")}</span>
                </button>
              </div>
              <div
                className={`my-1 border-t ${
                  isDark ? "border-white/10" : "border-zinc-200"
                }`}
              />
              <div className="pb-3 px-2 text-xs">
                <button
                  type="button"
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-left ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <HelpCircle className="h-4 w-4" />
                  <span>{t("chat.userMenu.help")}</span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut({ redirect: false });
                    setLoggedIn(false);
                    setUserEmail(null);
                    setShowUserMenu(false);
                  }}
                  className={`mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium cursor-pointer ${
                    isDark
                      ? "text-gray-100 hover:bg-white/10"
                      : "text-gray-800 hover:bg-zinc-100"
                  }`}
                >
                  <LogOut className="h-4 w-4" />
                  <span>{t("chat.userMenu.logout")}</span>
                </button>
              </div>
            </div>
          </>
        )}

        {showMobileSidebar && (
          <div
            className="fixed inset-0 z-30 bg-black/50 md:hidden"
            onClick={() => setShowMobileSidebar(false)}
            aria-hidden
          />
        )}
        <div className="flex flex-1 flex-col min-w-0 backdrop-blur-xl">
          <ChatHeader
            isDark={isDark}
            wsConnected={wsConnected}
            callStatus={callStatus}
            loggedIn={loggedIn}
            showMenu={showMenu}
            onToggleMenu={() => setShowMenu((prev) => !prev)}
            onToggleMobileSidebar={() =>
              setShowMobileSidebar((prev) => !prev)
            }
            onOpenLogin={() => setShowLoginDialog(true)}
            assistants={assistants}
            activeAssistantId={activeAssistantId}
            onChangeAssistant={(id) => setActiveAssistantId(id)}
            t={t}
          />

          {callActive && (
            <>
              {/* Mobile: overlay timer over content */}
              <div className="pointer-events-none fixed inset-x-0 top-2 z-30 flex justify-center md:hidden">
                <div
                  className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] ${
                    isDark
                      ? "bg-white/10 text-gray-100"
                      : "bg-zinc-900 text-zinc-100"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs">{callTimerLabel}</span>
                </div>
              </div>
            </>
          )}

          {loggedIn && showMenu && (activeConversationId || isAdminUser) && (
            <>
              <div
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
                aria-hidden
              />
              <div
                className={`absolute right-4 top-14 z-30 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
                  isDark
                    ? "border-white/10 bg-neutral-800/95"
                    : "border-zinc-200 bg-white"
                }`}
              >
                {activeConversationId && (
                  <>
                    <div className="px-1 pt-1">
                      <button
                        type="button"
                        onClick={handleArchiveConversation}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                          isDark
                            ? "text-slate-100 hover:bg-white/10"
                            : "text-slate-800 hover:bg-zinc-50"
                        }`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                        <span className="flex-1 text-left">
                          {t("chat.menu.archive")}
                        </span>
                      </button>
                    </div>
                    <div className="px-1 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteDialog(true);
                        }}
                        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                          isDark
                            ? "text-red-300 hover:bg-red-500/10"
                            : "text-red-600 hover:bg-red-50"
                        }`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="flex-1 text-left">
                          {t("chat.menu.delete")}
                        </span>
                      </button>
                    </div>
                    {isAdminUser && (
                      <div
                        className={`mx-3 my-1 h-px ${
                          isDark ? "bg-white/10" : "bg-zinc-200"
                        }`}
                      />
                    )}
                  </>
                )}
                {isAdminUser && (
                  <div className="px-1 pb-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowDebug((prev) => !prev);
                        setShowMenu(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                        isDark
                          ? "text-slate-100 hover:bg-white/10"
                          : "text-slate-800 hover:bg-zinc-50"
                      }`}
                    >
                      <Bug className="h-3.5 w-3.5 text-sky-300" />
                      <span className="flex-1 text-left">
                        {t("chat.menu.debug")} {showDebug ? "(on)" : "(off)"}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex flex-1 flex-col min-h-0 px-4 pb-6 sm:px-6 md:px-10 relative">
            {callActive && (
              <div className="pointer-events-none hidden md:flex absolute inset-x-0 top-2 z-20 justify-center">
                <div
                  className={`pointer-events-auto inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-medium tracking-[0.16em] ${
                    isDark
                      ? "bg-white/10 text-gray-100"
                      : "bg-zinc-900 text-zinc-100"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="font-mono text-xs">{callTimerLabel}</span>
                </div>
              </div>
            )}
            <div
              ref={chatRef}
              className="relative flex-1 overflow-y-auto pt-6 pb-4 pr-1"
            >
              {!initialChatId &&
                isNewChatLayout &&
                visibleMessages.length === 0 && (
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center justify-center px-1 pt-48 pb-16 text-center">
                  <h1
                    className={`text-3xl font-semibold tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {t("chat.hero.title")}
                  </h1>
                  <p
                    className={`mt-2 max-w-2xl text-sm ${
                      isDark ? "text-gray-300" : "text-gray-600"
                    }`}
                  >
                    {t("chat.hero.subtitle")}
                  </p>
                  {shouldShowInput && (
                    <div className="mt-6 w-full max-w-3xl">
                      <div className="relative">
                        <ChatTextInput
                          ref={inputRef}
                          isDark={isDark}
                          placeholder={t("chat.input.placeholderIdle")}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSendText();
                            }
                          }}
                          disabled={!wsConnected}
                        />
                        <Tooltip
                          placement="above"
                          offset={12}
                          align="end"
                          label={
                            hasTypedInput
                              ? t("chat.tooltip.send")
                              : t("chat.tooltip.startVoiceCall")
                          }
                        >
                          <button
                            onClick={() => {
                              if (hasTypedInput) {
                                handleSendText();
                              } else if (
                                callStatus !== "calling" &&
                                callStatus !== "in_call"
                              ) {
                            handleStartCall();
                            setShowMobileControls(true);
                          }
                        }}
                        className={`absolute right-2 top-1/2 -mt-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                          hasTypedInput
                            ? isDark
                              ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                              : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                            : isDark
                            ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                            : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                        }`}
                            disabled={!wsConnected || callStatus === "calling"}
                          >
                            {hasTypedInput ? (
                              <ArrowUp className="h-5 w-5" />
                            ) : (
                              <AudioLines className="h-5 w-5" />
                            )}
                          </button>
                        </Tooltip>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {initialChatId && !conversationHydrated && (
                <div className="mx-auto flex w-full max-w-3xl items-center justify-center px-1 pt-10 pb-4">
                  <div
                    className={`h-6 w-6 animate-spin rounded-full border-2 border-t-transparent ${
                      isDark
                        ? "border-gray-500"
                        : "border-gray-300"
                    }`}
                  />
                </div>
              )}

              {initialChatId &&
                conversationHydrated &&
                visibleMessages.length === 0 &&
                !conversationLoadError && (
                  <div className="mx-auto w-full max-w-3xl px-1 pt-10 pb-4 text-sm">
                    <p
                      className={
                        isDark ? "text-gray-300" : "text-gray-600"
                      }
                    >
                      {t("chat.emptyConversation")}
                    </p>
                  </div>
                )}

              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                {visibleMessages.map((message, idx) => {
                  const isAssistant = message.from === "assistant";
                  const isUser = message.from === "user";
                  const showActions = isAssistant && !loading;
                  const isLast = idx === messages.length - 1;
                  // When subtitles are disabled, hide both assistant and user text.
                  if (!showAssistantText && (isAssistant || isUser)) {
                    return null;
                  }
                  // For assistant messages, render markdown content with actions.
                  if (isAssistant) {
                    return (
                      <div key={message.id} className="space-y-2 px-1">
                        <MarkdownMessage text={message.text} />
                        {showActions && (
                          <div
                            className="flex items-center gap-1"
                            style={{ opacity: isLast ? 1 : 1 }}
                          >
                            <IconButton
                              size="sm"
                              isDark={isDark}
                              variant="ghost"
                              className="rounded-lg"
                              onClick={() => void handleCopy(message.text)}
                            >
                              <Tooltip label={t("chat.tooltip.copy")}>
                                <span>
                                  <Copy className="h-5 w-5" />
                                </span>
                              </Tooltip>
                            </IconButton>
                            <IconButton
                              size="sm"
                              isDark={isDark}
                              variant="ghost"
                              className="rounded-lg"
                              onClick={() => void speak(message.text)}
                            >
                              <Tooltip label={t("chat.tooltip.playAudio")}>
                                <span>
                                  <Volume2 className="h-5 w-5" />
                                </span>
                              </Tooltip>
                            </IconButton>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // For user/system messages, keep bubbles, but if it's a
                  // pending user utterance placeholder ("…"), render a
                  // breathing dot aligned to the user side instead of text.
                  const isPendingUserUtterance =
                    isUser && message.text === "…";

                  if (isPendingUserUtterance) {
                    return (
                      <div
                        key={message.id}
                        className="flex justify-end px-1"
                        aria-label="User is speaking"
                      >
                        <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.8)]" />
                      </div>
                    );
                  }

                  if (message.from === "user") {
                    return (
                      <div key={message.id} className="group px-1">
                        <ChatBubble
                          from={message.from}
                          meta={message.meta}
                          variant="chat"
                          className="rounded-[24px]"
                        >
                          {message.text}
                        </ChatBubble>
                        <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <IconButton
                            size="sm"
                            isDark={isDark}
                            variant="ghost"
                            className="rounded-lg"
                            onClick={() => void handleCopy(message.text)}
                          >
                            <Tooltip label={t("chat.tooltip.copy")}>
                              <span>
                                <Copy className="h-5 w-5" />
                              </span>
                            </Tooltip>
                          </IconButton>
                          <IconButton
                            size="sm"
                            isDark={isDark}
                            variant="ghost"
                            className="rounded-lg"
                            // Ellipsis button is intentionally a no-op for now.
                            onClick={() => {}}
                          >
                            <Ellipsis className="h-5 w-5" />
                          </IconButton>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <ChatBubble
                      key={message.id}
                      from={message.from}
                      meta={message.meta}
                      variant="chat"
                      className="rounded-[18px]"
                    >
                      {message.text}
                    </ChatBubble>
                  );
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="status-dot dot-online" />
                    {t("chat.status.thinking")}
                  </div>
                )}

                {showScrollDown && (
                  <div className="pointer-events-none sticky bottom-0 z-20 flex justify-center">
                    <button
                      type="button"
                      onClick={() => {
                        scrollToBottom();
                        setShowScrollDown(false);
                      }}
                      className={`pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border text-xs shadow-sm transition ${
                        isDark
                          ? "border-white/15 bg-neutral-900/85 text-white hover:bg-neutral-800"
                          : "border-zinc-200 bg-white/95 text-slate-900 hover:bg-zinc-100"
                      }`}
                      aria-label={t("chat.aria.scrollToBottom")}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {showDebug && (
              <div className="fixed inset-0 z-40 flex items-end justify-end pointer-events-none">
                <div
                  className={`pointer-events-auto m-4 rounded-2xl border px-4 py-3 text-xs shadow-lg flex flex-col overflow-hidden relative ${
                    isDark
                      ? "border-sky-500/40 bg-neutral-800/95 text-sky-100"
                      : "border-zinc-300 bg-white text-slate-900"
                  }`}
                  style={{
                    transform: `translate(${debugOffset.x}px, ${debugOffset.y}px)`,
                    width: `${debugSize.width}px`,
                    height: `${debugSize.height}px`,
                    maxWidth: "min(520px, 100% - 32px)",
                    maxHeight: "min(560px, 100% - 32px)",
                  }}
                >
                  <div
                    className="mb-2 cursor-move pr-6"
                    onMouseDown={handleDebugDragStart}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[11px] font-semibold ${
                          isDark ? "text-sky-300" : "text-sky-700"
                        }`}
                      >
                        Debug panel
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        WS: {wsConnected ? "connected" : "disconnected"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Call: {callStatus}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Mic: {micMuted ? "muted" : "open"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Speaker: {muted ? "muted" : "on"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Assistant: {assistantTalking ? "speaking" : "idle"}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-[1px] text-[10px] ${
                          isDark
                            ? "bg-neutral-800/80 text-slate-300"
                            : "bg-zinc-100 text-slate-700"
                        }`}
                      >
                        Scope: {currentScope || "n/a"}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowDebug(false);
                    }}
                    className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full ${
                      isDark
                        ? "bg-neutral-800 text-slate-300 hover:bg-neutral-700"
                        : "bg-zinc-200 text-slate-700 hover:bg-zinc-300"
                    }`}
                    aria-label="Close debug panel"
                  >
                    <X className="h-3 w-3" />
                  </button>

                  <div
                    className={`mt-1 flex-1 min-h-0 overflow-y-auto border-t pt-2 ${
                      isDark ? "border-white/10" : "border-zinc-200"
                    }`}
                  >
                    <div className="mb-2">
                      <button
                        type="button"
                        onClick={() => setConfigExpanded((prev) => !prev)}
                        className={`flex w-full items-center justify-between text-[11px] font-semibold ${
                          isDark ? "text-sky-300" : "text-sky-700"
                        }`}
                      >
                        <span>{t("chat.debug.config.title")}</span>
                        <span className="text-[10px] text-slate-400">
                          {configExpanded
                            ? t("chat.debug.config.collapse")
                            : t("chat.debug.config.expand")}
                        </span>
                      </button>
                      {configExpanded && (
                        <div className="mt-1">
                          {debugLoading && (
                            <p className="text-slate-400">
                              Loading debug config…
                            </p>
                          )}
                          {debugError && (
                            <p className="text-rose-400">
                              Error loading config: {debugError}
                            </p>
                          )}
                          {!debugLoading && !debugError && debugConfig && (
                            <div className="space-y-1">
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Profile blocks:
                                </span>{" "}
                                {Object.keys(
                                  debugConfig.profile ?? {}
                                ).join(", ") || "none"}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Tools:
                                </span>{" "}
                                {Array.isArray(debugConfig.tools) &&
                                debugConfig.tools.length > 0
                                  ? debugConfig.tools
                                      .map((t: any) => t.name)
                                      .join(", ")
                                  : "none"}
                              </p>
                              <p
                                className={`text-[11px] ${
                                  isDark ? "text-slate-200" : "text-slate-700"
                                }`}
                              >
                                <span
                                  className={`font-semibold ${
                                    isDark
                                      ? "text-sky-300"
                                      : "text-sky-700"
                                  }`}
                                >
                                  Sanitize rules:
                                </span>{" "}
                                {Array.isArray(debugConfig.sanitize) &&
                                debugConfig.sanitize.length > 0
                                  ? debugConfig.sanitize.length
                                  : 0}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div
                      className={`mt-1 border-t pt-2 ${
                        isDark ? "border-white/10" : "border-zinc-200"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setEventsExpanded((prev) => !prev)}
                          className={`flex w-full items-center justify-between text-[11px] font-semibold ${
                            isDark ? "text-sky-300" : "text-sky-700"
                          }`}
                        >
                          <span>{t("chat.debug.events.title")}</span>
                          <span className="text-[10px] text-slate-400">
                            {eventsExpanded
                              ? t("chat.debug.events.collapse")
                              : t("chat.debug.events.expand")}
                          </span>
                        </button>
                      </div>
                      {eventsExpanded && (
                        <div className="space-y-1 pr-1">
                          {debugEvents.length === 0 ? (
                            <p className="text-slate-400">
                              {t("chat.debug.events.empty")}
                            </p>
                          ) : (
                            debugEvents.map((event) => (
                              <div
                                key={event.id}
                                className={`flex items-start gap-2 rounded-lg px-2 py-1 ${
                                  isDark
                                    ? "bg-neutral-800/70"
                                    : "bg-zinc-100"
                                }`}
                              >
                                {event.meta && (
                                  <span className="mt-[2px] inline-flex shrink-0 rounded-full bg-sky-500/20 px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide text-sky-300">
                                    {event.meta}
                                  </span>
                                )}
                                <span
                                  className={`break-words text-[11px] ${
                                    isDark
                                      ? "text-slate-100"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {event.text}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleDebugResizeStart(e);
                    }}
                    className={`absolute bottom-1 right-1 flex h-4 w-4 cursor-se-resize items-center justify-center rounded-md border ${
                      isDark
                        ? "border-sky-500/70 bg-neutral-800/90 text-sky-300 hover:bg-neutral-700"
                        : "border-zinc-300 bg-zinc-200 text-slate-700 hover:bg-zinc-300"
                    }`}
                    aria-label={t("chat.debug.resize")}
                  >
                    <span className="inline-block h-2 w-2 rounded-sm border border-current" />
                  </button>
                </div>
              </div>
            )}

            {toast && (
              <div className="pointer-events-none absolute inset-x-0 top-4 z-[80] flex justify-center">
                <div
                  className={`pointer-events-auto inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm shadow-lg ${
                    toast.tone === "error"
                      ? isDark
                        ? "bg-red-600 text-white"
                        : "bg-red-500 text-white"
                      : isDark
                      ? "bg-neutral-700 text-white"
                      : "bg-neutral-100 text-gray-900"
                  }`}
                >
                  <span>{toast.message}</span>
                  <button
                    type="button"
                    onClick={() => setToast(null)}
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-current hover:bg-black/20 focus:outline-none"
                    aria-label="Dismiss message"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {showDeleteDialog && pendingDeleteId && (
              <ConfirmDialog
                open={showDeleteDialog}
                title={t("chat.menu.deleteTitle")}
                message={
                  <span>
                    {t("chat.menu.deleteBody")}{" "}
                      <strong>
                      {chats.find((c) => c.id === pendingDeleteId)?.title ??
                        t("chat.sidebar.newChat")}
                    </strong>
                    .
                  </span>
                }
                helperText={t("chat.menu.deleteHelper")}
                confirmLabel={t("chat.menu.delete")}
                cancelLabel={t("common.cancel")}
                variant="danger"
                onConfirm={handleDeleteConversation}
                onCancel={() => setShowDeleteDialog(false)}
              />
            )}

            {!isNewChatLayout && shouldShowInput && (
              <div className="mx-auto w-full max-w-3xl px-1 sm:px-1 pb-6">
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <ChatTextInput
                      ref={inputRef}
                      isDark={isDark}
                      placeholder={
                        callStatus === "in_call"
                          ? t("chat.input.placeholderInCall")
                          : t("chat.input.placeholderIdle")
                      }
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (input.trim()) {
                            handleSendText();
                          }
                        }
                      }}
                      disabled={!wsConnected}
                    />
                    <Tooltip
                      placement="above"
                      offset={12}
                      align="end"
                      label={
                        hasTypedInput
                          ? t("chat.tooltip.send")
                          : callStatus === "in_call"
                          ? t("chat.tooltip.endCall")
                          : t("chat.tooltip.startVoiceCall")
                      }
                    >
                      <button
                        onClick={() => {
                            if (hasTypedInput) {
                              handleSendText();
                            } else {
                              if (callStatus === "calling") return;
                              if (callStatus === "in_call") {
                                endCall();
                                setShowMobileControls(false);
                              } else {
                                handleStartCall();
                                setShowMobileControls(true);
                              }
                            }
                        }}
                        className={`absolute right-2 top-1/2 -mt-1.5 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border text-base font-semibold transition focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed ${
                          hasTypedInput
                            ? isDark
                              ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                              : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                            : callStatus === "in_call"
                            ? "border-rose-400/70 bg-rose-500/90 text-white hover:bg-rose-400 cursor-pointer"
                            : isDark
                            ? "border-transparent bg-white text-slate-900 hover:bg-zinc-300 cursor-pointer"
                            : "border-transparent bg-zinc-900 text-white hover:bg-zinc-600 cursor-pointer"
                        }`}
                        disabled={
                          hasTypedInput
                            ? !wsConnected
                            : !wsConnected || callStatus === "calling"
                        }
                      >
                        {hasTypedInput ? (
                          <ArrowUp className="h-5 w-5" />
                        ) : callStatus === "in_call" ? (
                          <X className="h-5 w-5" />
                        ) : (
                          <AudioLines className="h-5 w-5" />
                        )}
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </div>
            )}

            {showMobileControls && (
              <div className="mt-4">
                <div className="mx-auto flex w-full max-w-md items-center justify-center gap-4 px-2">
                  <button
                    onClick={() =>
                      setShowAssistantText((prev) => !prev)
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      !showAssistantText
                        ? "border-transparent bg-rose-100 text-rose-700"
                        : isDark
                        ? "border-white/20 bg-neutral-800 text-white"
                        : "border-zinc-300 bg-zinc-800 text-white"
                    }`}
                  >
                    <Tooltip
                      label={
                        showAssistantText
                          ? t("chat.tooltip.hideChatText")
                          : t("chat.tooltip.showChatText")
                      }
                    >
                      <span>
                        {showAssistantText ? (
                          <MessageCircle className="h-4 w-4" />
                        ) : (
                          <MessageCircleOff className="h-4 w-4" />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={toggleSpeaker}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                      muted
                        ? "border-transparent bg-rose-100 text-rose-700"
                        : isDark
                        ? "border-white/20 bg-neutral-800 text-white"
                        : "border-zinc-300 bg-zinc-800 text-white"
                    }`}
                  >
                    <Tooltip
                      label={
                        muted
                          ? t("chat.tooltip.unmuteSpeaker")
                          : t("chat.tooltip.muteSpeaker")
                      }
                    >
                      <span>
                        {muted ? (
                          <VolumeX
                            strokeWidth={1.8}
                            className="h-5 w-5 text-rose-700"
                          />
                        ) : (
                          <Volume2
                            strokeWidth={1.8}
                            className="h-5 w-5 text-white"
                          />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={() => {
                      if (callStatus === "in_call") {
                        endCall();
                        setShowMobileControls(false);
                        setShowInputDuringCall(false);
                        resetToNewChatIfEmpty();
                      } else if (callStatus !== "calling") {
                        handleStartCall();
                        setShowMobileControls(true);
                      }
                    }}
                    className={`flex h-16 w-16 items-center justify-center rounded-full border text-white transition active:scale-95 ${
                      callStatus === "in_call"
                        ? "border-rose-500/50 bg-rose-500"
                        : callStatus === "calling"
                        ? "border-amber-400/60 bg-amber-500 animate-pulse"
                        : "border-emerald-400/60 bg-emerald-500"
                    }`}
                  >
                    <Tooltip
                      label={
                        callStatus === "in_call"
                          ? t("chat.tooltip.endCall")
                          : t("chat.tooltip.startCall")
                      }
                    >
                      <span>
                        {callStatus === "in_call" ? (
                          <X className="h-8 w-8" />
                        ) : (
                          <AudioLines className="h-7 w-7" />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={toggleMic}
                    className={`flex h-12 w-12 items-center justify-center rounded-full border transition ${
                      micMuted
                        ? "border-transparent bg-rose-100 text-rose-700"
                        : isDark
                        ? "border-white/20 bg-neutral-800 text-white"
                        : "border-zinc-300 bg-zinc-800 text-white"
                    }`}
                  >
                    <Tooltip
                      label={
                        micMuted
                          ? t("chat.tooltip.unmuteMic")
                          : t("chat.tooltip.muteMic")
                      }
                    >
                      <span>
                        {micMuted ? (
                          <MicOff
                            strokeWidth={1.8}
                            className="h-5 w-5 text-rose-700"
                          />
                        ) : (
                          <Mic
                            strokeWidth={1.8}
                            className="h-5 w-5 text-white"
                          />
                        )}
                      </span>
                    </Tooltip>
                  </button>
                  <button
                    onClick={() =>
                      setShowInputDuringCall((prev) => !prev)
                    }
                    className={`flex h-10 w-10 items-center justify-center rounded-full border transition ${
                      !showInputDuringCall
                        ? "border-transparent bg-rose-100 text-rose-700"
                        : isDark
                        ? "border-white/20 bg-neutral-800 text-white"
                        : "border-zinc-300 bg-zinc-800 text-white"
                    }`}
                  >
                    <Tooltip
                      label={
                        showInputDuringCall
                          ? t("chat.tooltip.hideTextInput")
                          : t("chat.tooltip.showTextInput")
                      }
                    >
                      <span>
                        <TextCursorInput className="h-4 w-4" />
                      </span>
                    </Tooltip>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <SettingsDialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      />
      <LoginDialog
        open={showLoginDialog}
        onClose={() => setShowLoginDialog(false)}
        onLoggedIn={(email) => {
          setLoggedIn(true);
          setUserEmail(email);
          setShowLoginDialog(false);
        }}
      />
    </main>
  );
}
