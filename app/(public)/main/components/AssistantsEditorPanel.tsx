"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Plus, Wand2 } from "lucide-react";
import {
  AssistantConfigPanel,
  AssistantConfig,
} from "./AssistantConfigPanel";
import { ConfirmDialog } from "@/components/front/ui/ConfirmDialog";

export type EditorAssistantSummary = {
  id: string;
  name: string;
  description: string | null;
  createdAt?: string;
};

type AssistantsEditorPanelProps = {
  isDark: boolean;
  t: (key: string) => string;
  currentUserId: string | null;
  workspaceId: string | null;
  assistants: EditorAssistantSummary[];
  activeAssistantId: string | null;
  onAssistantsChange: (next: EditorAssistantSummary[]) => void;
  onActiveAssistantChange: (id: string | null) => void;
};

export function AssistantsEditorPanel({
  isDark,
  t,
  currentUserId,
  workspaceId,
  assistants,
  activeAssistantId,
  onAssistantsChange,
  onActiveAssistantChange,
}: AssistantsEditorPanelProps) {
  const [assistantConfig, setAssistantConfig] =
    useState<AssistantConfig | null>(null);
  const [assistantConfigLoading, setAssistantConfigLoading] = useState(false);
  const [assistantConfigError, setAssistantConfigError] = useState<
    string | null
  >(null);
  const [assistantConfigSaving, setAssistantConfigSaving] = useState(false);
  const [assistantFormName, setAssistantFormName] = useState<string>("");
  const [assistantFormDescription, setAssistantFormDescription] = useState<
    string
  >("");
  const [showDeleteAssistantDialog, setShowDeleteAssistantDialog] =
    useState(false);
  const [pendingDeleteAssistantId, setPendingDeleteAssistantId] = useState<
    string | null
  >(null);

  const selectedAssistant = useMemo(
    () => assistants.find((a) => a.id === activeAssistantId) ?? null,
    [assistants, activeAssistantId]
  );

  const groupedAssistants = useMemo(() => {
    if (!assistants.length) return [];

    // Order assistants from most recent to oldest by createdAt.
    const sorted = [...assistants].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });

    const groups: {
      key: string;
      label: string;
      items: EditorAssistantSummary[];
    }[] = [];
    const byKey: Record<string, number> = {};

    for (const assistant of sorted) {
      const date = assistant.createdAt ? new Date(assistant.createdAt) : null;
      const key =
        date && !Number.isNaN(date.getTime())
          ? date.toISOString().slice(0, 10)
          : "unknown";
      let label: string;
      if (date && !Number.isNaN(date.getTime())) {
        label = date.toLocaleDateString(undefined, {
          weekday: undefined,
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } else {
        label = t("chat.assistants.listTitle");
      }
      if (byKey[key] === undefined) {
        byKey[key] = groups.length;
        groups.push({ key, label, items: [assistant] });
      } else {
        groups[byKey[key]].items.push(assistant);
      }
    }

    return groups;
  }, [assistants, t]);

  useEffect(() => {
    if (!activeAssistantId) {
      setAssistantConfig(null);
      setAssistantConfigError(null);
      setAssistantConfigLoading(false);
      return;
    }
    let cancelled = false;
    async function loadConfig() {
      try {
        setAssistantConfigLoading(true);
        setAssistantConfigError(null);
        const res = await fetch(`/api/assistants/${activeAssistantId}/config`);
        if (!res.ok) {
          setAssistantConfigError("Failed to load assistant configuration.");
          return;
        }
        const data = (await res.json()) as AssistantConfig;
        if (!cancelled) {
          setAssistantConfig(data);
        }
      } catch (err) {
        console.error("Failed to load assistant config:", err);
        if (!cancelled) {
          setAssistantConfigError("Failed to load assistant configuration.");
        }
      } finally {
        if (!cancelled) {
          setAssistantConfigLoading(false);
        }
      }
    }
    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [activeAssistantId]);

  useEffect(() => {
    if (!assistantConfig) return;
    setAssistantFormName(assistantConfig.assistant.name);
    setAssistantFormDescription(assistantConfig.assistant.description ?? "");
  }, [assistantConfig]);

  async function updateAssistantInstructions(
    updates: { id: string; enabled: boolean; sortOrder?: number }[]
  ) {
    if (!activeAssistantId || !updates.length) return;
    try {
      setAssistantConfigSaving(true);
      const res = await fetch(
        `/api/assistants/${activeAssistantId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instructions: updates }),
        }
      );
      if (!res.ok) {
        console.error("Failed to update instructions:", await res.text());
        return;
      }
      setAssistantConfig((prev) =>
        prev
          ? {
              ...prev,
              instructions: prev.instructions.map((inst) => {
                const u = updates.find((x) => x.id === inst.id);
                return u
                  ? {
                      ...inst,
                      enabled: u.enabled,
                      sortOrder:
                        typeof u.sortOrder === "number"
                          ? u.sortOrder
                          : inst.sortOrder,
                    }
                  : inst;
              }),
            }
          : prev
      );
    } finally {
      setAssistantConfigSaving(false);
    }
  }

  async function updateAssistantTools(
    updates: { id: string; enabled: boolean }[]
  ) {
    if (!activeAssistantId || !updates.length) return;
    try {
      setAssistantConfigSaving(true);
      const res = await fetch(
        `/api/assistants/${activeAssistantId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tools: updates }),
        }
      );
      if (!res.ok) {
        console.error("Failed to update tools:", await res.text());
        return;
      }
      setAssistantConfig((prev) =>
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
      setAssistantConfigSaving(false);
    }
  }

  async function updateAssistantSanitize(
    updates: { id: string; enabled: boolean }[]
  ) {
    if (!activeAssistantId || !updates.length) return;
    try {
      setAssistantConfigSaving(true);
      const res = await fetch(
        `/api/assistants/${activeAssistantId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sanitize: updates }),
        }
      );
      if (!res.ok) {
        console.error(
          "Failed to update sanitize rules:",
          await res.text()
        );
        return;
      }
      setAssistantConfig((prev) =>
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
      setAssistantConfigSaving(false);
    }
  }

  async function saveAssistantBasics() {
    if (!activeAssistantId) return;
    const trimmedName = assistantFormName.trim();
    if (!trimmedName) return;
    try {
      setAssistantConfigSaving(true);
      const res = await fetch(
        `/api/assistants/${activeAssistantId}/config`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            assistant: {
              name: trimmedName,
              description: assistantFormDescription,
            },
          }),
        }
      );
      if (!res.ok) {
        console.error("Failed to update assistant:", await res.text());
        return;
      }
      setAssistantConfig((prev) =>
        prev
          ? {
              ...prev,
              assistant: {
                ...prev.assistant,
                name: trimmedName,
                description: assistantFormDescription || null,
              },
            }
          : prev
      );
      onAssistantsChange(
        assistants.map((a) =>
          a.id === activeAssistantId ? { ...a, name: trimmedName } : a
        )
      );
    } catch (err) {
      console.error("Failed to update assistant:", err);
    } finally {
      setAssistantConfigSaving(false);
    }
  }

  async function handleCreateAssistant() {
    if (!workspaceId || !currentUserId) return;
    try {
      const res = await fetch("/api/assistants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          userId: currentUserId,
        }),
      });
      if (!res.ok) {
        console.error("Failed to create assistant:", await res.text());
        return;
      }
      const data = await res.json();
      const created = data.assistant as {
        id: string;
        name: string;
        description: string | null;
        createdAt: string;
      };
      const next = [
        ...assistants,
        {
          id: created.id,
          name: created.name,
          description: created.description,
          createdAt: created.createdAt,
        },
      ];
      onAssistantsChange(next);
      onActiveAssistantChange(created.id);
    } catch (err) {
      console.error("Failed to create assistant:", err);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-1 flex-col md:flex-row">
        <div
          className={`flex w-full md:max-w-md flex-col text-sm ${
            isDark ? "bg-neutral-800" : "bg-white"
          }`}
        >
          {assistants.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${
                  isDark
                    ? "border-neutral-700 bg-neutral-900 text-gray-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500"
                }`}
              >
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <p
                  className={`text-base font-semibold ${
                    isDark ? "text-gray-50" : "text-zinc-900"
                  }`}
                >
                  {t("chat.assistants.emptyTitle")}
                </p>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {t("chat.assistants.emptyHelper")}
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={handleCreateAssistant}
                  className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium ${
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-gray-100"
                      : "bg-black text-white hover:bg-neutral-900"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  {t("chat.assistants.create")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-y-auto">
              <div className="flex items-center justify-between px-2 pt-3 pb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400 md:px-3">
                <span>{t("chat.assistants.listTitle")}</span>
                <button
                  type="button"
                  onClick={handleCreateAssistant}
                  className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium ${
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-gray-100"
                      : "bg-black text-white hover:bg-neutral-900"
                  }`}
                >
                  <Plus className="h-4 w-4" />
                  <span>{t("chat.assistants.create")}</span>
                </button>
              </div>
              <div className="flex-1 pb-4">
                {groupedAssistants.map((group) => (
                  <div key={group.key} className="px-2 md:px-3">
                    <div className="mt-3 mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      {group.label}
                    </div>
                    {group.items.map((assistant) => {
                      const active = assistant.id === activeAssistantId;
                      const createdAtLabel =
                        assistant.createdAt && !Number.isNaN(Date.parse(assistant.createdAt))
                          ? new Date(assistant.createdAt).toLocaleTimeString(
                              undefined,
                              { hour: "numeric", minute: "2-digit" }
                            )
                          : null;
                      return (
                        <button
                          key={assistant.id}
                          type="button"
                          onClick={() =>
                            onActiveAssistantChange(assistant.id)
                          }
                          className={`mt-1 flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                            active
                              ? isDark
                                ? "bg-neutral-900 text-zinc-50"
                                : "bg-zinc-100 text-zinc-900"
                              : isDark
                              ? "hover:bg-neutral-900 text-zinc-300"
                              : "hover:bg-zinc-50 text-gray-800"
                          }`}
                        >
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold">
                              {assistant.name ||
                                t("chat.assistants.untitled")}
                            </span>
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {assistant.id}
                            </span>
                          </div>
                          {createdAtLabel && (
                            <span className="ml-4 text-xs text-zinc-500 dark:text-zinc-400">
                              {createdAtLabel}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className={`flex flex-1 flex-col text-sm relative overflow-hidden border-t pt-4 md:pt-0 md:border-t-0 md:border-l md:pl-4 ${
            isDark
              ? "border-neutral-700 bg-neutral-800"
              : "border-zinc-200 bg-white"
          }`}
        >
          {activeAssistantId && assistantConfig && (
            <AssistantConfigPanel
              isDark={isDark}
              assistantConfig={assistantConfig}
              loading={assistantConfigLoading}
              error={assistantConfigError}
              saving={assistantConfigSaving}
              assistantFormName={assistantFormName}
              assistantFormDescription={assistantFormDescription}
              onChangeName={setAssistantFormName}
              onChangeDescription={setAssistantFormDescription}
              onSaveBasics={saveAssistantBasics}
              updateInstructions={updateAssistantInstructions}
              updateTools={updateAssistantTools}
              updateSanitize={updateAssistantSanitize}
              setAssistantConfig={setAssistantConfig}
              activeAssistantId={activeAssistantId}
              currentUserId={currentUserId}
              onDeleteAssistant={(assistantId) => {
                setPendingDeleteAssistantId(assistantId);
                setShowDeleteAssistantDialog(true);
              }}
            />
          )}
          {!activeAssistantId && (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
              <div className="flex flex-col items-center gap-2 text-center">
                <Wand2 className="h-6 w-6" />
                <p>{t("chat.assistants.selectHelper")}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {showDeleteAssistantDialog && pendingDeleteAssistantId && (
        <ConfirmDialog
          open={showDeleteAssistantDialog}
          title={t("assistant.config.deleteTitle")}
          message={
            <span>
              {t("assistant.config.deleteBody")}{" "}
              <strong>
                {assistants.find((a) => a.id === pendingDeleteAssistantId)
                  ?.name || t("chat.assistants.untitled")}
              </strong>
              .
            </span>
          }
          helperText={t("assistant.config.deleteHelper")}
          confirmLabel={t("assistant.config.deleteConfirmButton")}
          cancelLabel={t("common.cancel")}
          variant="danger"
          onConfirm={async () => {
            const id = pendingDeleteAssistantId;
            setShowDeleteAssistantDialog(false);
            setPendingDeleteAssistantId(null);
            try {
              const res = await fetch(`/api/assistants/${id}`, {
                method: "DELETE",
              });
              if (!res.ok) {
                console.error(
                  "Failed to delete assistant:",
                  await res.text()
                );
                return;
              }
              const remaining = assistants.filter((a) => a.id !== id);
              onAssistantsChange(remaining);
              const nextActive = remaining[0]?.id ?? null;
              onActiveAssistantChange(nextActive);
            } catch (err) {
              console.error("Failed to delete assistant:", err);
            }
          }}
          onCancel={() => {
            setShowDeleteAssistantDialog(false);
            setPendingDeleteAssistantId(null);
          }}
        />
      )}
    </div>
  );
}
