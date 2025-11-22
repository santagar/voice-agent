"use client";

import React, { useEffect, useMemo } from "react";
import { ArrowUp, Mic, MicOff, Phone, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Modal } from "@/components/ui/Modal";
import { PillButton } from "@/components/ui/PillButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import sanitizeRules from "@/config/sanitize.json";
import toolsConfig from "@/config/tools.json";
import profile from "@/config/profile.json";
import { labTheme } from "@/lib/theme";
import {
  useRealtimeVoiceSession,
  VoiceMessage,
  ScopeDefinition,
} from "@/lib/voice/useRealtimeVoiceSession";

const START_CALL_PROMPT =
  "Start a voice assistant conversation in Spanish. Lead with a short greeting and ask how you can help.";

const DEFAULT_SCOPE_RULES: ScopeDefinition[] = [];

export default function LabPage() {
  const {
    messages,
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
    scopes,
    sessionActive,
    canStartCall,
    sendDisabled,
    startCall,
    endCall,
    toggleSpeaker,
    toggleMic,
    handleSubmit,
  } = useRealtimeVoiceSession({
    startCallPrompt: START_CALL_PROMPT,
    initialScope: "support",
  });

  const hasTypedInput = input.trim().length > 0;
  const chatContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [sanitizeModalOpen, setSanitizeModalOpen] = React.useState(false);
  const [toolsModalOpen, setToolsModalOpen] = React.useState(false);
  const [scopeModalOpen, setScopeModalOpen] = React.useState(false);
  const [profileModalOpen, setProfileModalOpen] = React.useState(false);
  const sanitizationList = (sanitizeRules as Array<{
    description: string;
    pattern: string;
    replacement?: string;
  }>) ?? [];
  const toolsList =
    ((toolsConfig as { tools?: Array<{ name: string; description: string }> })
      .tools ?? []);
  const profileBlocks = Object.entries(profile || {});
  const scopeCatalog = useMemo(() => {
    const merged = new Map<string, Set<string>>();
    DEFAULT_SCOPE_RULES.forEach((scope) => {
      const keywords = new Set<string>(
        scope.keywords.map((kw) => kw.toLowerCase())
      );
      keywords.add(scope.name.toLowerCase());
      merged.set(scope.name, keywords);
    });
    scopes.forEach((scope) => {
      const incoming = new Set<string>(
        (scope.keywords || []).map((kw) => kw.toLowerCase())
      );
      incoming.add(scope.name.toLowerCase());
      if (!merged.has(scope.name)) {
        merged.set(scope.name, incoming);
      } else {
        const existing = merged.get(scope.name)!;
        incoming.forEach((kw) => existing.add(kw));
      }
    });
    return Array.from(merged.entries()).map(([name, keywords]) => ({
      name,
      keywords: Array.from(keywords),
    }));
  }, [scopes]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <main
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ backgroundImage: labTheme.gradients.canvas }}
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-12 lg:flex-row lg:items-stretch">
        {/* Left column: control panel */}
        <section
          className="flex w-full flex-col rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-xl lg:max-w-sm"
          style={{ borderRadius: labTheme.radii.shell }}
        >
          <header className="mb-6">
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Lab Mode
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Voice Agent
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Realtime reasoning, custom policies, and full voice control.
            </p>
          </header>

          <div className="space-y-4 text-sm">
            <Card>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Realtime API WebSocket</span>
                <span
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    wsConnected ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  {wsConnected ? "Online" : "Offline"}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-3 text-slate-200">
                <span
                  className={`h-3 w-3 rounded-full ${
                    wsConnected ? "bg-emerald-400" : "bg-rose-400"
                  }`}
                />
                <span className="text-xs font-medium">
                  {wsConnected
                    ? "Streaming ready"
                    : "Waiting for realtime-server"}
                </span>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between text-slate-300">
                <span>Voice session</span>
                <StatusBadge status={callStatus} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-medium text-slate-400">
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Mic
                  </p>
                  <p className="mt-1 text-base text-white">
                    {micMuted
                      ? "Muted"
                      : isRecording
                      ? "Listening"
                      : "Idle"}
                  </p>
                </div>
                <div className="rounded-xl border border-white/10 bg-slate-900/60 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-slate-500">
                    Assistant
                  </p>
                  <p className="mt-1 text-base text-white">
                    {assistantTalking ? "Speaking" : "Ready"}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {callStatus === "in_call" ? (
                  <>
                    <button
                      onClick={toggleSpeaker}
                      className={`group flex-1 cursor-pointer rounded-full border px-3.5 py-2.5 transition-all ${
                        muted
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
                          : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                      }`}
                      title={muted ? "Unmute speaker" : "Mute speaker"}
                    >
                      {muted ? (
                        <VolumeX strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      ) : (
                        <Volume2 strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={toggleMic}
                      className={`group flex-1 cursor-pointer rounded-full border px-3.5 py-2.5 transition-all ${
                        micMuted
                          ? "border-sky-500/60 bg-sky-500/10 text-sky-200"
                          : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                      }`}
                      title={micMuted ? "Unmute mic" : "Mute mic"}
                    >
                      {micMuted ? (
                        <MicOff strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      ) : (
                        <Mic strokeWidth={1.8} className="mx-auto h-5 w-5" />
                      )}
                    </button>
                    <button
                      onClick={endCall}
                      className="group flex-1 cursor-pointer rounded-full border border-rose-500/70 bg-rose-500/20 px-3.5 py-2.5 text-rose-100 hover:bg-rose-500/30"
                      title="End call"
                    >
                      <Phone strokeWidth={1.8} className="mx-auto h-5 w-5" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={startCall}
                    disabled={!wsConnected}
                    className="w-full cursor-pointer rounded-full border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 font-semibold text-emerald-100 transition disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-slate-500"
                  >
                    <span className="flex items-center justify-center gap-2 text-base">
                      <Phone strokeWidth={1.8} className="h-4 w-4" />
                      Voice session
                    </span>
                  </button>
                )}
              </div>
            </Card>

            <Card tone="muted" className="text-xs text-slate-400">
              <p className="mb-2 font-semibold text-slate-200">Session notes</p>
              <ul className="space-y-1">
                <li>• Voice is fully synthetic and auto-muted when the assistant speaks.</li>
                <li>• You can still type while the mic is open.</li>
                <li>• Safety policies and RAG context apply to every reply.</li>
              </ul>
            </Card>
          </div>
        </section>

        {/* Right column: conversation + composer */}
        <section
          className="flex flex-1 flex-col rounded-[28px] border border-white/5 bg-slate-950/80"
          style={{
            borderRadius: labTheme.radii.panel,
            boxShadow: labTheme.shadows.panel,
          }}
        >
          <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-slate-500">
                Lab Mode
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-white">
                Chat
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <PillButton onClick={() => setScopeModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-sky-400" />
                Scope: {currentScope}
              </PillButton>
              <PillButton onClick={() => setProfileModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-rose-400" />
                Profile
              </PillButton>
              <PillButton onClick={() => setSanitizeModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Sanitized streaming
              </PillButton>
              <PillButton onClick={() => setToolsModalOpen(true)}>
                <span className="h-2 w-2 rounded-full bg-purple-400" />
                Tools
              </PillButton>
            </div>
          </div>

          <div
            className="h-[460px] space-y-4 overflow-y-auto px-6 py-8"
            ref={chatContainerRef}
          >
            {messages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                Awaiting your first prompt. Start the call or type a message to brief
                the assistant.
              </div>
            )}
            {messages.map((message) => (
              <ChatBubble key={message.id} from={message.from} meta={message.meta}>
                {message.text}
              </ChatBubble>
            ))}
            {loading && (
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Assistant drafting response…
              </div>
            )}
          </div>

          <form
            onSubmit={handleSubmit}
            className="border-t border-white/5 px-6 py-4"
          >
            <div className="flex gap-3">
              <div className="flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-4">
                <input
                  type="text"
                  className="h-12 w-full bg-transparent text-sm text-white placeholder:text-slate-500 focus:outline-none"
                  placeholder={
                    callStatus === "in_call"
                      ? "Speak or type additional instructions…"
                      : "Type a prompt for the assistant…"
                  }
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button
                type={hasTypedInput ? "submit" : "button"}
                onClick={() => {
                  if (hasTypedInput) return;
                  if (callStatus === "calling") return;
                  if (callStatus === "in_call") {
                    endCall();
                  } else if (callStatus === "idle") {
                    startCall();
                  }
                }}
                disabled={hasTypedInput ? !wsConnected : callStatus === "calling" || !wsConnected}
                className={`flex h-12 w-14 items-center justify-center rounded-2xl border text-base font-semibold transition focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-60 ${
                  hasTypedInput
                    ? "border-white/15 bg-white text-slate-900 hover:bg-slate-100"
                    : callStatus === "in_call"
                    ? "border-rose-500/70 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
                    : callStatus === "calling"
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-50"
                    : "border-emerald-400/60 bg-emerald-500/15 text-emerald-100 hover:bg-emerald-500/25"
                }`}
                title={
                  hasTypedInput
                    ? "Send message"
                    : callStatus === "in_call"
                    ? "End call"
                    : callStatus === "calling"
                    ? "Dialing…"
                    : canStartCall
                    ? "Start voice session"
                    : wsConnected
                    ? "Session already active"
                    : "Connect to realtime server"
                }
              >
                {hasTypedInput ? (
                  <ArrowUp strokeWidth={1.8} className="h-5 w-5" />
                ) : (
                  <Phone strokeWidth={1.8} className="h-5 w-5" />
                )}
              </button>
            </div>
          </form>
        </section>
      </div>
      {sanitizeModalOpen && (
        <Modal title="Sanitization rules" onClose={() => setSanitizeModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {sanitizationList.map((rule, idx) => (
              <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">{rule.description}</p>
                <p className="mt-1 text-xs text-slate-300 break-words">
                  Pattern: <code className="text-emerald-200">{rule.pattern}</code>
                </p>
                {rule.replacement && (
                  <p className="text-xs text-slate-400 break-words">
                    Replacement: <code>{rule.replacement}</code>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
      {toolsModalOpen && (
        <Modal title="Enabled tools" onClose={() => setToolsModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {toolsList.map((tool) => (
              <div
                key={tool.name}
                className="rounded-xl border border-white/10 bg-white/5 p-3"
              >
                <p className="font-semibold text-white">{tool.name}</p>
                <p className="text-xs text-slate-300">{tool.description}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {profileModalOpen && (
        <Modal title="Assistant profile" onClose={() => setProfileModalOpen(false)}>
          <div className="space-y-3 text-sm text-slate-200">
            {profileBlocks.map(([key, values]) => (
              <div key={key} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-semibold text-white">
                  {key.replace(/_/g, " ").replace(/\b\w/g, (s) => s.toUpperCase())}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-300">
                  {(Array.isArray(values) ? values : []).map((line, idx) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {scopeModalOpen && (
        <Modal title="Available scopes" onClose={() => setScopeModalOpen(false)}>
          <div className="space-y-2 text-sm text-slate-200">
            {scopeCatalog.map((scope) => (
              <div
                key={scope.name}
                className={`rounded-2xl border px-4 py-2 ${
                  scope.name === currentScope
                    ? "border-emerald-400/60 bg-emerald-500/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-200"
                }`}
              >
                <p className="font-semibold capitalize">{scope.name}</p>
                {scope.keywords.length > 0 && (
                  <p className="text-xs text-slate-400">
                    Keywords: {scope.keywords.join(", ")}
                  </p>
                )}
                {scope.name === currentScope && (
                  <span className="ml-2 text-xs text-emerald-200">(current)</span>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
}
