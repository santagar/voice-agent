"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Ellipsis } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeContext";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { IconButton } from "@/components/front/ui/IconButton";

type InstructionConfig = {
  id: string;
  type: string;
  label: string | null;
  lines: string[];
  enabled: boolean;
  sortOrder: number;
};

type ToolConfig = {
  id: string;
  name: string;
  kind: string | null;
  description: string | null;
  enabled: boolean;
};

type SanitizationRuleConfig = {
  id: string;
  description: string | null;
  direction: string;
  enabled: boolean;
  sortOrder: number;
};

type AssistantConfigResponse = {
  assistant: {
    id: string;
    name: string;
    description: string | null;
  };
  instructions: InstructionConfig[];
  tools: ToolConfig[];
  sanitize: SanitizationRuleConfig[];
};

export default function AssistantConfigPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const assistantId = searchParams.get("assistantId");
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AssistantConfigResponse | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    if (!assistantId) {
      setError("No assistant selected.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadConfig() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/assistants/${assistantId}/config`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("Assistant not found.");
          } else {
            setError("Failed to load assistant configuration.");
          }
          return;
        }
        const data = (await res.json()) as AssistantConfigResponse;
        if (!cancelled) {
          setConfig(data);
        }
      } catch (err) {
        console.error("Failed to load assistant config:", err);
        if (!cancelled) {
          setError("Failed to load assistant configuration.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [assistantId]);

  async function updateInstructions(updates: { id: string; enabled: boolean }[]) {
    if (!assistantId || !updates.length) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/assistants/${assistantId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: updates }),
      });
      if (!res.ok) {
        console.error("Failed to update instructions:", await res.text());
        return;
      }
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              instructions: prev.instructions.map((inst) => {
                const u = updates.find((x) => x.id === inst.id);
                return u ? { ...inst, enabled: u.enabled } : inst;
              }),
            }
          : prev
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateTools(updates: { id: string; enabled: boolean }[]) {
    if (!assistantId || !updates.length) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/assistants/${assistantId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tools: updates }),
      });
      if (!res.ok) {
        console.error("Failed to update tools:", await res.text());
        return;
      }
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              tools: prev.tools.map((tool) => {
                const u = updates.find((x) => x.id === tool.id);
                return u ? { ...tool, enabled: u.enabled } : tool;
              }),
            }
          : prev
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateSanitize(
    updates: { id: string; enabled: boolean }[]
  ) {
    if (!assistantId || !updates.length) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/assistants/${assistantId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sanitize: updates }),
      });
      if (!res.ok) {
        console.error("Failed to update sanitize rules:", await res.text());
        return;
      }
      setConfig((prev) =>
        prev
          ? {
              ...prev,
              sanitize: prev.sanitize.map((rule) => {
                const u = updates.find((x) => x.id === rule.id);
                return u ? { ...rule, enabled: u.enabled } : rule;
              }),
            }
          : prev
      );
    } finally {
      setSaving(false);
    }
  }

  const busy = loading || saving;

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950 text-slate-100"
          : "bg-slate-50 text-slate-900"
      }`}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pb-16 pt-4 md:px-8 md:pt-6">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`ml-0.5 mr-1 h-2.5 w-2.5 rounded-full ${
                isDark ? "bg-emerald-400" : "bg-emerald-500"
              }`}
              aria-hidden
            />
            <div
              className={`flex h-9 items-center gap-2 rounded-lg border px-3 ${
                isDark
                  ? "border-white/10 bg-neutral-900/60"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <span className="text-xs font-medium text-slate-300">
                Assistant
              </span>
              <span className="truncate text-sm font-semibold">
                {config?.assistant?.name ?? "Voice assistant"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {busy && (
              <div
                className={`rounded-full border px-3 py-1 text-xs ${
                  isDark
                    ? "border-slate-700 bg-slate-900/90 text-slate-200"
                    : "border-zinc-200 bg-white text-slate-700"
                }`}
              >
                {loading ? "Loading…" : "Saving…"}
              </div>
            )}
            <IconButton
              isDark={isDark}
              variant="ghost"
              className={`rounded-lg ${!isDark ? "hover:bg-zinc-100" : ""}`}
              onClick={() => setShowMenu((prev) => !prev)}
            >
              <Tooltip label="More options">
                <span>
                  <Ellipsis className="h-5 w-5" />
                </span>
              </Tooltip>
            </IconButton>
          </div>
        </header>

        {showMenu && (
          <>
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowMenu(false)}
              aria-hidden
            />
            <div
              className={`absolute right-4 top-16 z-30 w-48 rounded-xl border shadow-lg backdrop-blur-sm ${
                isDark
                  ? "border-white/10 bg-neutral-800/95"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <div className="px-1 py-1">
                <button
                  type="button"
                  onClick={() => {
                    router.push("/");
                    setShowMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[15px] cursor-pointer ${
                    isDark
                      ? "text-slate-100 hover:bg-white/10"
                      : "text-slate-800 hover:bg-zinc-50"
                  }`}
                >
                  <span className="flex-1 text-left">Back to chat</span>
                </button>
              </div>
            </div>
          </>
        )}

        <div className="mt-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Configure assistant
          </h1>
          {config?.assistant?.description && (
            <p className="mt-1 text-sm text-slate-400">
              {config.assistant.description}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-sm text-red-100">
            {error}
          </div>
        )}

        {!loading && !error && config && (
          <div className="grid gap-4 md:grid-cols-3">
            <section className="md:col-span-1 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-100">
                Instructions
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Choose which instruction blocks feed the assistant&apos;s
                system prompt.
              </p>
              <div className="mt-3 space-y-2">
                {config.instructions.map((inst) => (
                  <label
                    key={inst.id}
                    className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-xs hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                      checked={inst.enabled}
                      onChange={() =>
                        updateInstructions([
                          { id: inst.id, enabled: !inst.enabled },
                        ])
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">
                          {inst.label || inst.type}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                          {inst.type}
                        </span>
                      </div>
                      {inst.lines && inst.lines.length > 0 && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                          {inst.lines[0]}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
                {config.instructions.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No instructions available.
                  </p>
                )}
              </div>
            </section>

            <section className="md:col-span-1 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-100">Tools</h2>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Enable or disable tools the assistant can call during a
                conversation.
              </p>
              <div className="mt-3 space-y-2">
                {config.tools.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-xs hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                      checked={tool.enabled}
                      onChange={() =>
                        updateTools([{ id: tool.id, enabled: !tool.enabled }])
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">
                          {tool.name}
                        </span>
                        {tool.kind && (
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                            {tool.kind}
                          </span>
                        )}
                      </div>
                      {tool.description && (
                        <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                          {tool.description}
                        </p>
                      )}
                    </div>
                  </label>
                ))}
                {config.tools.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No tools available.
                  </p>
                )}
              </div>
            </section>

            <section className="md:col-span-1 rounded-3xl border border-slate-800/80 bg-slate-950/80 p-4 shadow-sm">
              <h2 className="text-sm font-medium text-slate-100">
                Sanitization rules
              </h2>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Control which redact/replace patterns apply to this assistant&apos;s
                responses.
              </p>
              <div className="mt-3 space-y-2">
                {config.sanitize.map((rule) => (
                  <label
                    key={rule.id}
                    className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-800/70 bg-slate-900/60 px-3 py-2 text-xs hover:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-sky-500 focus:ring-sky-500"
                      checked={rule.enabled}
                      onChange={() =>
                        updateSanitize([
                          { id: rule.id, enabled: !rule.enabled },
                        ])
                      }
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-100">
                          {rule.description || "Rule"}
                        </span>
                        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                          {rule.direction}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
                {config.sanitize.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No sanitization rules available.
                  </p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
