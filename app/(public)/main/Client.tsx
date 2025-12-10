"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { X } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";
import { useLocale } from "@/components/locale/LocaleContext";
import { useRealtimeSession } from "@/hooks/useRealtimeSession";
import { usePathname, useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/front/ui/ConfirmDialog";
import { Sidebar, ChatSummary, ChatSummaryMode } from "./components/Sidebar";
import { Header } from "./components/Header";
import { AssistantSummary } from "./components/AssistantSelector";
import { TextView } from "./components/TextView";
import { VoiceView } from "./components/VoiceView";
import { DebugPanel } from "./components/DebugPanel";
import { SessionDialogs } from "./components/SessionDialogs";
import {
  AssistantsManager,
  EditorAssistantSummary,
} from "../a/editor/components/AssistantsManager";
import { SessionProvider, useSession } from "./context/SessionContext";
import { useAssistantConfig } from "./hooks/useAssistantConfig";
import { useSanitizeRules } from "./hooks/useSanitizeRules";
import { useConversationHydration } from "./hooks/useConversationHydration";
import { useConversationActions } from "./hooks/useConversationActions";
import { useConversationLifecycle } from "./hooks/useConversationLifecycle";
import { createTranscriptGuard } from "./utils/transcriptGuard";
import { useApiConversations } from "@/hooks/useApiConversations";
import { useApiMessages } from "@/hooks/useApiMessages";
import { useApiSessions } from "@/hooks/useApiSessions";
import { VoiceMessage } from "@/hooks/useRealtimeSession";

type ViewMode = "chat" | "assistant-editor";

const START_CALL_PROMPT =
  "Arranca una conversación de voz amable y breve en español. Presentate y pregunta en qué puedes ayudar.";

type MainClientProps = {
  initialSidebarCollapsed: boolean;
  initialLoggedIn?: boolean;
  initialUserEmail?: string | null;
  initialChatId?: string | null;
  initialMessages?: VoiceMessage[] | null;
  initialUserName?: string | null;
  initialUserImage?: string | null;
  currentUserId?: string | null;
  workspaceId?: string | null;
  assistantId?: string | null;
  initialChats?: ChatSummary[] | null;
  initialAssistants?: AssistantSummary[] | null;
  initialViewMode?: ViewMode;
};

type MainClientWithCleanup = MainClientProps & {
  setSignOutCleanup: (fn: () => void) => void;
};

function MainClientInner({
  initialSidebarCollapsed,
  initialChatId = null,
  initialMessages = null,
  currentUserId = null,
  workspaceId = null,
  assistantId = null,
  initialChats = null,
  initialAssistants = null,
  initialViewMode = "chat",
  setSignOutCleanup,
}: MainClientWithCleanup) {
  const initialAssistantList: AssistantSummary[] =
    initialAssistants && initialAssistants.length
      ? initialAssistants
      : assistantId
      ? [{ id: assistantId, name: "Voice Agent" }]
      : [];
  const initialActiveAssistantId =
    assistantId && initialAssistantList.some((a) => a.id === assistantId)
      ? assistantId
      : initialAssistantList[0]?.id ?? assistantId ?? null;
  const [assistants, setAssistants] = useState<AssistantSummary[]>(
    initialAssistantList
  );
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(
    initialActiveAssistantId
  );
  const [sessionId, setSessionId] = useState<string | null>(null);
  const sessionCreatingRef = useRef(false);
  const lastSessionKeyRef = useRef<string | null>(null);
  const userPatchedRef = useRef(false);
  const { createSession: createSessionApi, updateSession } = useApiSessions();

  const {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    wsConnected,
    callStatus,
    assistantTalking,
    muted,
    micMuted,
    currentScope,
    bridgeConnections,
    startCall,
    endCall,
    toggleSpeaker: voiceToggleSpeaker,
    toggleMic: voiceToggleMic,
    sendUserMessage,
    connectNow,
  } = useRealtimeSession({
    startCallPrompt: START_CALL_PROMPT,
    initialScope: "support",
    autoConnect: Boolean(initialChatId && sessionId),
    sessionId: sessionId,
    onSessionClosed: async (status) => {
      if (!sessionId) return;
      try {
        await updateSession(sessionId, { status });
      } catch (err) {
        console.error("Failed to update session status", err);
      }
    },
    onUserUtteranceStarted: () => {
      transcriptGuardRef.current.hold();
    },
    onUserUtteranceFinished: () => {
      transcriptGuardRef.current.release();
    },
    onUserTranscriptFinal: async (text: string) => {
      const promise = persistVoiceTranscript(text);
      transcriptGuardRef.current.register(promise);
      try {
        await promise;
      } catch (err) {
        console.error("Failed to persist voice transcript:", err);
      } finally {
        transcriptGuardRef.current.release();
      }
    },
    onAssistantTurnFinal: async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      await transcriptGuardRef.current.wait();

      const conversationId =
        activeConversationIdRef.current ||
        (await createConversationIfNeeded(
          "New chat",
          callStatus === "in_call" || callStatus === "calling"
            ? "voice"
            : "text"
        ));

      if (!conversationId) return;

      // Determine which sanitize rules (if any) appear to have fired
      // on this assistant message by checking for their replacement
      // markers in the sanitized text.
      const appliedRules =
        Array.isArray(sanitizeRules) && sanitizeRules.length
          ? sanitizeRules.filter((rule) => {
              if (!rule?.replacement) return false;
              return trimmed.includes(rule.replacement);
            })
          : [];

      const sanitized =
        Array.isArray(appliedRules) && appliedRules.length > 0;
      const sanitizationMeta =
        sanitized && appliedRules.length
          ? {
              direction: "out" as const,
              ruleIds: appliedRules
                .map((r) => r.id)
                .filter((id): id is string => !!id),
            }
          : undefined;

      // TODO: Assistant message persistence should ideally be handled
      // from the Realtime bridge once the full message is known, to
      // avoid issues with partial messages or duplicates.
      void appendMessage(conversationId, {
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
          sanitized,
          ...(sanitizationMeta ? { sanitization: sanitizationMeta } : {}),
        },
      }).catch((err) => {
        console.error("Failed to persist assistant message:", err);
      });
    },
  });

  const [isMobile, setIsMobile] = useState(false);
  const [showMobileControls, setShowMobileControls] = useState(false);
  const [showInputDuringCall, setShowInputDuringCall] = useState(false);
  const [showAssistantText, setShowAssistantText] = useState(true);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [configExpanded, setConfigExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(true);
  const [showLoginDialog, setShowLoginDialog] = useState(false);
  const {
    loggedIn,
    isAdminUser,
    setLoggedIn,
    setUserEmail,
  } = useSession();
  const [chats, setChats] = useState<ChatSummary[]>(initialChats ?? []);
  const [activeChatId, setActiveChatId] = useState<string | null>(
    initialChatId ?? null
  );
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialChatId ?? null
  );
  // Track the latest conversation id across renders to avoid races when persisting.
  const activeConversationIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mq = window.matchMedia("(max-width: 767px)");
    const applyMatch = (event: MediaQueryListEvent | MediaQueryList) => {
      const matches = event.matches;
      setIsMobile(matches);
      if (!matches) {
        setShowMobileControls(false);
      }
    };

    applyMatch(mq);

    const listener = (event: MediaQueryListEvent) => applyMatch(event);
    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", listener);
    } else {
      mq.addListener(listener);
    }

    return () => {
      if (typeof mq.removeEventListener === "function") {
        mq.removeEventListener("change", listener);
      } else {
        mq.removeListener(listener);
      }
    };
  }, []);
  useEffect(() => {
    async function ensureSessionEntry() {
      // No crear sesión hasta tener el usuario cargado
    if (!currentUserId) return;
    if (!activeAssistantId || sessionCreatingRef.current) return;
    const sessionKey = `${activeAssistantId}::${activeConversationId ?? ""}`;

      // If we already have a session but conversationId just appeared, update it instead of creating new.
    if (
      sessionId &&
      activeConversationId &&
      lastSessionKeyRef.current &&
      lastSessionKeyRef.current !== sessionKey
    ) {
      try {
        await updateSession(sessionId, { conversationId: activeConversationId });
        lastSessionKeyRef.current = sessionKey;
        return;
      } catch (err) {
          console.error("Failed to update session conversationId", err);
        }
      }

    if (sessionId && lastSessionKeyRef.current === sessionKey) return;
    sessionCreatingRef.current = true;
    try {
      const id = await createSessionApi({
        userId: currentUserId ?? null,
        assistantId: activeAssistantId,
        conversationId: activeConversationId ?? null,
        channel: "web",
        assistantConfig: null,
      });
        if (id) {
          setSessionId(id);
          lastSessionKeyRef.current = sessionKey;
          userPatchedRef.current = false;
        }
      } catch (err) {
        console.error("Failed to create session", err);
      } finally {
        sessionCreatingRef.current = false;
      }
    }
    ensureSessionEntry();
  }, [
    activeAssistantId,
    activeConversationId,
    createSessionApi,
    currentUserId,
    initialChatId,
    sessionId,
    updateSession,
  ]);

  // If the session was created before we had the user loaded, patch it.
  useEffect(() => {
    if (!sessionId || !currentUserId || userPatchedRef.current) return;
    void (async () => {
      try {
        const ok = await updateSession(sessionId, { userId: currentUserId });
        if (ok) userPatchedRef.current = true;
      } catch (err) {
        console.error("Failed to patch session userId", err);
      }
    })();
  }, [currentUserId, sessionId, updateSession]);
  const transcriptGuardRef = useRef(createTranscriptGuard());
  const router = useRouter();
  const pathname = usePathname();
  const { sanitizeRules } = useSanitizeRules();
  
  const [isNewChatLayout, setIsNewChatLayout] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    tone: "error" | "info";
  } | null>(null);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { t } = useLocale();
  const chatRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Used to avoid re-persisting the same assistant snapshot multiple times.
  const persistedMessageIdsRef = useRef<Set<string>>(new Set());
  const hasTypedInput = input.trim().length > 0;
  const { createConversation } = useApiConversations();
  const { appendMessage } = useApiMessages();
  const addChatIfMissing = useCallback(
    (chat: ChatSummary) => {
      setChats((prev) => {
        if (prev.some((c) => c.id === chat.id)) return prev;
        return [chat, ...prev];
      });
    },
    [setChats]
  );
  const conversationCreatingRef = useRef(false);
  const createConversationIfNeeded = useCallback(
    async (title: string, mode: ChatSummaryMode) => {
      if (conversationCreatingRef.current) return null;
      if (activeConversationIdRef.current) return activeConversationIdRef.current;
      if (!activeAssistantId || !workspaceId) return null;

      conversationCreatingRef.current = true;
      try {
        const conv = await createConversation({
          title,
          mode,
          userId: currentUserId,
          assistantId: activeAssistantId,
          workspaceId,
        });
        if (!conv?.id) return null;

        const id = conv.id as string;
        setActiveConversationId(id);
        activeConversationIdRef.current = id;
        addChatIfMissing({
          id,
          title: conv.title as string,
          mode: (conv.mode as ChatSummaryMode) ?? mode,
          createdAt: conv.createdAt as string,
          updatedAt: conv.updatedAt as string,
          lastMessageFrom: null,
          lastMessageAt: null,
        });
        return id;
      } catch (err) {
        console.error("Failed to create conversation:", err);
        return null;
      } finally {
        conversationCreatingRef.current = false;
      }
    },
    [
      activeAssistantId,
      activeConversationId,
      addChatIfMissing,
      currentUserId,
      createConversation,
      workspaceId,
    ]
  );
  const persistVoiceTranscript = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      const conversationId =
        activeConversationIdRef.current ||
        (await createConversationIfNeeded("New voice chat", "voice"));
      if (!conversationId) return;
      await appendMessage(conversationId, {
        from: "user",
        text: trimmed,
        meta: {
          turnType: "user_voice",
          scope: currentScope,
          inputMode: "microphone",
          outputMode:
            callStatus === "in_call" || callStatus === "calling"
              ? "voice"
              : "text",
          bargeIn: false,
        },
      });
    },
    [
      activeConversationId,
      callStatus,
      createConversationIfNeeded,
      currentScope,
      appendMessage,
    ]
  );
  useEffect(() => {
    setSignOutCleanup(() => () => {
      setAssistants([]);
      setActiveAssistantId(null);
    });
  }, [setSignOutCleanup]);
  const normalizedInitialViewMode: ViewMode =
    initialViewMode === "assistant-editor" ? "assistant-editor" : "chat";
  const [viewMode, setViewMode] = useState<ViewMode>(normalizedInitialViewMode);
  const isChatView = viewMode === "chat";
  const { assistantConfig, assistantConfigLoading, assistantConfigError } =
    useAssistantConfig(activeAssistantId, viewMode);
  const {
    conversationHydrated,
    conversationLoadError,
    hydratedFromServerRef,
    hydratedFromServer,
  } = useConversationHydration(
    initialChatId ?? null,
    t,
    setMessages,
    setActiveConversationId,
    setActiveChatId,
    setIsNewChatLayout,
    initialMessages
  );
  const {
    handleNewChat,
    handleSelectChat,
    handleArchiveConversation,
    handleDeleteConversation,
    handleArchiveChat,
    handleRenameChat,
  } = useConversationActions({
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
  });
  const assistantHasConfig = useMemo(() => {
    // Return true by default to avoid refreshing inconsistency while loading.
    if (!assistantConfig) return true;
    const enabledInstructions = assistantConfig.instructions.some(
      (i) => i.enabled
    );
    const enabledTools = assistantConfig.tools.some((t) => t.enabled);
    const enabledRules = assistantConfig.sanitize.some((r) => r.enabled);
    return enabledInstructions || enabledTools || enabledRules;
  }, [assistantConfig]);
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
  }, [messages, setMessages, setIsNewChatLayout, setActiveChatId]);

  const visibleMessages = useMemo(
    () => messages.filter((m) => m.from !== "system"),
    [messages]
  );

  const debugEvents = useMemo(
    () => messages.filter((m) => m.from === "system"),
    [messages]
  );

  const { callActive, callTimerLabel } = useConversationLifecycle({
    callStatus,
    activeAssistantId,
    workspaceId,
    currentUserId,
    activeConversationId,
    visibleMessages,
    setActiveConversationId,
    setActiveChatId,
    setChats,
  });

  const handleMobileControlsChange = useCallback(
    (show: boolean, force?: boolean) => {
      if (show && !isMobile && !force) {
        setShowMobileControls(false);
        return;
      }
      setShowMobileControls(show);
    },
    [isMobile]
  );

  const toggleCallControls = useCallback(
    () => handleMobileControlsChange(!showMobileControls, true),
    [handleMobileControlsChange, showMobileControls]
  );

  useEffect(() => {
    if (!callActive) {
      handleMobileControlsChange(false);
      return;
    }

    setShowInputDuringCall(!isMobile);
    handleMobileControlsChange(true);
  }, [callActive, handleMobileControlsChange, isMobile]);

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

  function toggleSpeaker() {
    voiceToggleSpeaker();
  }

  function toggleMic() {
    voiceToggleMic();
  }

  function handleStartCall() {
    setShowInputDuringCall(!isMobile);
    setIsNewChatLayout(false);
    handleMobileControlsChange(true);
    startCall();
  }

  const handleSelectChatWithClose = useCallback(
    (id: string) => {
      void connectNow();
      handleSelectChat(id);
      setShowMobileSidebar(false);
    },
    [connectNow, handleSelectChat, setShowMobileSidebar]
  );

  async function handleSendText() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setIsNewChatLayout(false);

    let conversationId = activeConversationIdRef.current ?? activeConversationId;

    // For text-only flows, ensure we have a Conversation as soon as the
    // user sends the first message.
    if (!conversationId && activeAssistantId && workspaceId) {
      try {
        const mode: ChatSummaryMode =
          callStatus === "in_call" || callStatus === "calling"
            ? "voice"
            : "text";
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
          activeConversationIdRef.current = conversationId;
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
    }

    setInput("");
    void sendUserMessage(trimmed, {
      conversationId,
      assistantId: activeAssistantId ?? undefined,
    });

    // Persist the user's message immediately if we have a conversation id.
    if (conversationId) {
      const persistPromise = appendMessage(conversationId, {
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
      })
        .catch((err) => {
          console.error("Failed to persist user message:", err);
        })
        .then(() => undefined);

      // Ensure assistant persistence waits for the user message write.
      transcriptGuardRef.current.register(persistPromise as Promise<void>);
    }
  }

  const shouldShowInput = !callActive || showInputDuringCall;

  useEffect(() => {
    if (viewMode !== "assistant-editor") return;
    if (!activeAssistantId) return;
    if (!pathname.startsWith("/a/editor")) return;

    const parts = pathname.split("/");
    const currentId = parts[parts.length - 1];
    if (currentId !== activeAssistantId) {
      router.replace(`/a/editor/${activeAssistantId}`);
    }
  }, [activeAssistantId, viewMode, pathname, router]);

  // Ensure a Conversation exists once there is a first real message
  // (user or assistant) in the current session.
  useEffect(() => {
    if (activeConversationId) return;
    if (!activeAssistantId || !workspaceId) return;
    // For voice, let it be created from onAssistantTurnFinal to avoid duplicates.
    if (callStatus === "in_call" || callStatus === "calling") return;
    if (conversationCreatingRef.current) return;

    const userOrAssistantMessages = visibleMessages.filter(
      (m) => (m.from === "user" || m.from === "assistant") && m.text.trim()
    );
    if (userOrAssistantMessages.length === 0) return;

    const mode: ChatSummaryMode = "text";

    void (async () => {
      try {
        conversationCreatingRef.current = true;
        const conv = await createConversation({
          title: "New voice chat",
          mode,
          userId: currentUserId,
          assistantId: activeAssistantId,
          workspaceId,
        });
        if (conv?.id) {
          setActiveConversationId(conv.id as string);
          addChatIfMissing({
            id: conv.id as string,
            title: conv.title as string,
            mode: (conv.mode as ChatSummaryMode) ?? "unknown",
            createdAt: conv.createdAt as string,
            updatedAt: conv.updatedAt as string,
            lastMessageFrom: null,
            lastMessageAt: null,
          });
        }
        conversationCreatingRef.current = false;
      } catch (err) {
        console.error("Failed to create conversation:", err);
        conversationCreatingRef.current = false;
      }
    })();
  }, [
    activeConversationId,
    activeAssistantId,
    callStatus,
    currentUserId,
    visibleMessages,
    workspaceId,
    addChatIfMissing,
  ]);

  // NOTE: For now we only persist user messages from the client.
  // Assistant messages are streamed token-by-token, so capturing a
  // single, stable snapshot is better done from the Realtime bridge
  // once the final transcript is known.

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Read any pending toast stored for the current route (e.g. when
  // redirected here after a failed /c/[chatId] load).
  useEffect(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? window.sessionStorage.getItem("va-toast")
          : null;
      if (stored) {
        const id = window.setTimeout(() => {
          setToast({ message: stored, tone: "error" });
          window.sessionStorage.removeItem("va-toast");
        }, 0);
        return () => window.clearTimeout(id);
      }
    } catch {
      // ignore storage errors
    }
  }, [pathname]);

  return (
    <main
      className={`min-h-screen overflow-hidden ${
        isDark
          ? "bg-neutral-800 text-slate-100"
          : "bg-white text-slate-900"
      }`}
    >
      <div className="flex h-screen overflow-hidden">
        <Sidebar
          isDark={isDark}
          initialSidebarCollapsed={initialSidebarCollapsed}
          showMobileSidebar={showMobileSidebar}
          chats={chats}
          activeChatId={activeChatId}
          t={t}
          onNewChat={handleNewChat}
          onSelectChat={handleSelectChatWithClose}
          onOpenSettings={() => setShowSettingsDialog(true)}
          onOpenPlatform={() => {
            router.push("/platform");
          }}
          onFocusInput={() => inputRef.current?.focus()}
          onChatsChange={setChats}
          onCloseMobileSidebar={() => setShowMobileSidebar(false)}
          onArchiveChat={handleArchiveChat}
          onDeleteChat={(id) => {
            setPendingDeleteId(id);
            setShowDeleteDialog(true);
          }}
          onRenameChat={handleRenameChat}
        />

        <div className="flex flex-1 flex-col min-w-0 backdrop-blur-xl">
          <Header
            isDark={isDark}
            wsConnected={wsConnected}
            callStatus={callStatus}
            loggedIn={loggedIn}
            isAdminUser={isAdminUser}
            assistantHasConfig={assistantHasConfig}
            showMenu={showMenu}
            onToggleMenu={() => setShowMenu((prev) => !prev)}
            onCloseMenu={() => setShowMenu(false)}
            onToggleMobileSidebar={() =>
              setShowMobileSidebar((prev) => !prev)
            }
            onOpenLogin={() => setShowLoginDialog(true)}
            assistants={assistants}
            activeAssistantId={activeAssistantId}
            onChangeAssistant={(id) => setActiveAssistantId(id)}
            viewMode={viewMode}
            isChatView={isChatView}
            hasActiveConversation={!!activeConversationId}
            onBackToChat={() => setViewMode("chat")}
            onArchiveConversation={() =>
              handleArchiveConversation(activeConversationId)
            }
            onRequestDeleteConversation={() => {
              setPendingDeleteId(activeConversationId);
              setShowDeleteDialog(true);
            }}
            showDebug={showDebug}
            onToggleDebug={() => setShowDebug((prev) => !prev)}
            assistantSelectorDisabled={viewMode === "assistant-editor"}
            t={t}
          />

          <div
            className={`flex flex-1 flex-col min-h-0 relative ${
              viewMode === "assistant-editor"
                ? "pb-0 px-2 sm:px-3 md:px-4"
                : "pb-3 px-4 sm:px-6 md:px-10"
            }`}
          >
            {viewMode === "assistant-editor" && (
              <AssistantsManager
                isDark={isDark}
                t={t}
                currentUserId={currentUserId ?? null}
                workspaceId={workspaceId ?? null}
                assistants={assistants as EditorAssistantSummary[]}
                activeAssistantId={activeAssistantId}
                onAssistantsChange={(next) => {
                  setAssistants(next);
                }}
                onActiveAssistantChange={(id) => setActiveAssistantId(id)}
              />
            )}
            {isChatView &&
              (callActive ? (
                <VoiceView
                  isDark={isDark}
                  t={t}
                  chatRef={chatRef}
                  inputRef={inputRef}
                  messages={messages}
                  visibleMessages={visibleMessages}
                  input={input}
                  setInput={setInput}
                  loading={loading}
                  assistantTalking={assistantTalking}
                  callStatus={callStatus}
                  showAssistantText={showAssistantText}
                  shouldShowInput={shouldShowInput}
                  hasTypedInput={hasTypedInput}
                  micMuted={micMuted}
                  callTimerLabel={callTimerLabel}
                  assistantHasConfig={assistantHasConfig}
                  conversationHydrated={conversationHydrated}
                  conversationLoadError={conversationLoadError}
                  initialChatId={activeConversationId ?? initialChatId}
                  isNewChatLayout={isNewChatLayout}
                  hydratedFromServer={hydratedFromServer}
                  onSendText={handleSendText}
                  onEndCall={endCall}
                  onToggleMobileControls={handleMobileControlsChange}
                  onOpenCallControls={toggleCallControls}
                  onStartCall={handleStartCall}
                  onSetShowMobileControls={handleMobileControlsChange}
                  onCopy={handleCopy}
                  onSpeak={speak}
                  muted={muted}
                  showInputDuringCall={showInputDuringCall}
                  showMobileControls={showMobileControls}
                  onToggleAssistantText={() =>
                    setShowAssistantText((prev) => !prev)
                  }
                  onToggleInputDuringCall={() =>
                    setShowInputDuringCall((prev) => !prev)
                  }
                  onSetInputDuringCall={setShowInputDuringCall}
                  onToggleSpeaker={toggleSpeaker}
                  onToggleMic={toggleMic}
                  onResetAfterEnd={resetToNewChatIfEmpty}
                  callActive={callActive}
                  callTimerLabel={callTimerLabel}
                />
              ) : (
                <TextView
                  isDark={isDark}
                  t={t}
                  chatRef={chatRef}
                  inputRef={inputRef}
                  messages={messages}
                  visibleMessages={visibleMessages}
                  input={input}
                  setInput={setInput}
                  loading={loading}
                  assistantTalking={assistantTalking}
                  callStatus={callStatus}
                  showAssistantText={showAssistantText}
                  shouldShowInput={shouldShowInput}
                  hasTypedInput={hasTypedInput}
                  micMuted={micMuted}
                  showMobileControls={showMobileControls}
                  callTimerLabel={callTimerLabel}
                  assistantHasConfig={assistantHasConfig}
                  conversationHydrated={conversationHydrated}
                  conversationLoadError={conversationLoadError}
                  initialChatId={activeConversationId ?? initialChatId}
                  isNewChatLayout={isNewChatLayout}
                  hydratedFromServer={hydratedFromServer}
                  onSendText={handleSendText}
                  onEndCall={endCall}
                  onToggleMobileControls={handleMobileControlsChange}
                  onOpenCallControls={toggleCallControls}
                  onStartCall={handleStartCall}
                  onSetShowMobileControls={handleMobileControlsChange}
                  onCopy={handleCopy}
                  onSpeak={speak}
                />
              ))}

            {showDebug && (
              <DebugPanel
                isDark={isDark}
                t={t}
                wsConnected={wsConnected}
                callStatus={callStatus}
                micMuted={micMuted}
                muted={muted}
                assistantTalking={assistantTalking}
                currentScope={currentScope}
                configExpanded={configExpanded}
                setConfigExpanded={setConfigExpanded}
                eventsExpanded={eventsExpanded}
                setEventsExpanded={setEventsExpanded}
                debugEvents={debugEvents}
                onClose={() => setShowDebug(false)}
                assistantConfig={assistantConfig}
                assistantConfigLoading={assistantConfigLoading}
                assistantConfigError={assistantConfigError}
                sessionId={sessionId}
                activeConversationId={activeConversationId}
                assistantId={activeAssistantId}
                bridgeConnections={bridgeConnections}
              />
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
                onConfirm={() => {
                  void (async () => {
                    // Si se borra la conversación activa, cerramos la sesión asociada.
                    if (sessionId && pendingDeleteId === activeConversationId) {
                      try {
                        await updateSession(sessionId, { status: "closed" });
                      } catch (err) {
                        console.error("Failed to close session on delete:", err);
                      } finally {
                        setSessionId(null);
                        lastSessionKeyRef.current = null;
                      }
                    }
                    await handleDeleteConversation(pendingDeleteId);
                  })();
                  setShowDeleteDialog(false);
                  setPendingDeleteId(null);
                }}
                onCancel={() => {
                  setShowDeleteDialog(false);
                  setPendingDeleteId(null);
                }}
              />
            )}

          </div>
        </div>
      </div>
      <SessionDialogs
        showSettingsDialog={showSettingsDialog}
        showLoginDialog={showLoginDialog}
        onCloseSettings={() => setShowSettingsDialog(false)}
        onCloseLogin={() => setShowLoginDialog(false)}
        onLoggedIn={(email) => {
          setLoggedIn(true);
          setUserEmail(email);
        }}
      />
    </main>
  );
}

export default function MainClient({
  initialLoggedIn = false,
  initialUserEmail = null,
  initialUserName = null,
  initialUserImage = null,
  ...props
}: MainClientProps) {
  const cleanupRef = useRef<() => void>(() => {});
  return (
    <SessionProvider
      initialLoggedIn={initialLoggedIn}
      initialUserEmail={initialUserEmail}
      initialUserName={initialUserName}
      initialUserImage={initialUserImage}
      onSignOut={() => cleanupRef.current()}
    >
      <MainClientInner
        {...props}
        setSignOutCleanup={(fn) => {
          cleanupRef.current = fn;
        }}
      />
    </SessionProvider>
  );
}
