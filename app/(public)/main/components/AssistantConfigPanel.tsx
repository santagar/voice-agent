"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  Ban,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  Plus,
  SquareFunction,
  Trash2,
  X,
} from "lucide-react";
import { Tooltip } from "@/components/front/ui/Tooltip";
import { useLocale } from "@/components/locale/LocaleContext";

export type AssistantConfigInstruction = {
  id: string;
  type: string;
  label: string | null;
  lines: string[];
  enabled: boolean;
  sortOrder: number;
};

export type AssistantConfigTool = {
  id: string;
  name: string;
  kind: string | null;
  description: string | null;
  enabled: boolean;
  owned?: boolean;
};

export type AssistantConfigRule = {
  id: string;
  description: string | null;
  direction: string;
  enabled: boolean;
  sortOrder: number;
};

export type AssistantConfig = {
  assistant: {
    id: string;
    name: string;
    description: string | null;
    updatedAt?: string;
  };
  instructions: AssistantConfigInstruction[];
  tools: AssistantConfigTool[];
  sanitize: AssistantConfigRule[];
};

type AssistantConfigPanelProps = {
  isDark: boolean;
  assistantConfig: AssistantConfig | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  assistantFormName: string;
  assistantFormDescription: string;
  onChangeName: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onSaveBasics: () => void;
  updateInstructions: (
    updates: { id: string; enabled: boolean; sortOrder?: number }[]
  ) => Promise<void>;
  updateTools: (updates: { id: string; enabled: boolean }[]) => Promise<void>;
  updateSanitize: (
    updates: { id: string; enabled: boolean }[]
  ) => Promise<void>;
  setAssistantConfig: Dispatch<SetStateAction<AssistantConfig | null>>;
  activeAssistantId: string | null;
  currentUserId: string | null;
  onDeleteAssistant: (assistantId: string) => void;
};

function FullscreenPortal({ children }: { children: React.ReactNode }) {
  if (typeof window === "undefined") return null;
  return createPortal(children, document.body);
}

export function AssistantConfigPanel({
  isDark,
  assistantConfig,
  loading,
  error,
  saving,
  assistantFormName,
  assistantFormDescription,
  onChangeName,
  onChangeDescription,
  onSaveBasics,
  updateInstructions,
  updateTools,
  updateSanitize,
  setAssistantConfig,
  activeAssistantId,
  currentUserId,
  onDeleteAssistant,
}: AssistantConfigPanelProps) {
  const { t } = useLocale();
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showFunctionsJsonModal, setShowFunctionsJsonModal] =
    useState(false);
  const [functionsJsonText, setFunctionsJsonText] = useState("");
  const [functionsJsonError, setFunctionsJsonError] = useState<
    string | null
  >(null);
  const [availableToolTemplates, setAvailableToolTemplates] = useState<
    {
      name: string;
      kind: string | null;
      description: string;
      definition: any;
    }[]
  >([]);
  const [selectedToolTemplateName, setSelectedToolTemplateName] = useState<
    string | null
  >(null);
  const [showFunctionsTypeMenu, setShowFunctionsTypeMenu] = useState(false);
  const [functionsCustomMode, setFunctionsCustomMode] = useState(false);
  const [functionsOwnedKind, setFunctionsOwnedKind] =
    useState<string>("business");
  const [showFunctionsKindMenu, setShowFunctionsKindMenu] =
    useState(false);
  const functionsJsonPreRef = useRef<HTMLPreElement | null>(null);
  const functionsJsonGutterRef = useRef<HTMLDivElement | null>(null);
  const [functionsJsonSaving, setFunctionsJsonSaving] = useState(false);
  const [functionsEditingToolId, setFunctionsEditingToolId] = useState<
    string | null
  >(null);
  const [functionsEditingOwned, setFunctionsEditingOwned] = useState(false);

  const [showInstructionEditor, setShowInstructionEditor] = useState(false);
  const [editingInstructionId, setEditingInstructionId] = useState<
    string | null
  >(null);
  const [instructionEditorType, setInstructionEditorType] = useState("");
  const [instructionEditorLabel, setInstructionEditorLabel] = useState("");
  const [instructionEditorText, setInstructionEditorText] = useState("");
  const [instructionEditorSaving, setInstructionEditorSaving] =
    useState(false);
  const [dragInstructionId, setDragInstructionId] = useState<string | null>(
    null
  );
  const [showInstructionTypeInfo, setShowInstructionTypeInfo] =
    useState(false);
  const [showInstructionFooterInfo, setShowInstructionFooterInfo] =
    useState(false);
  const instructionEditorGutterRef = useRef<HTMLDivElement | null>(null);
  const instructionEditorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [instructionEditorCols, setInstructionEditorCols] = useState<
    number | null
  >(null);
  const [instructionEditorLineHeight, setInstructionEditorLineHeight] =
    useState<number | null>(null);
  const [instructionTemplates, setInstructionTemplates] = useState<
    Record<string, string[]>
  >({});

  const instructionEditorLines = useMemo(
    () => instructionEditorText.split("\n"),
    [instructionEditorText]
  );

  const instructionEditorRowsPerLine = useMemo(
    () => {
      if (!instructionEditorCols) {
        return instructionEditorLines.map(() => 1);
      }
      return instructionEditorLines.map((line) => {
        const length = line.length || 1;
        return Math.max(1, Math.ceil(length / instructionEditorCols));
      });
    },
    [instructionEditorLines, instructionEditorCols]
  );

  useEffect(() => {
    if (!showInstructionEditor) return;
    if (typeof window === "undefined") return;
    const textarea = instructionEditorTextareaRef.current;
    if (!textarea) return;
    const style = window.getComputedStyle(textarea);
    const lineHeightPx =
      parseFloat(style.lineHeight || "") ||
      (parseFloat(style.fontSize || "") || 16) * 1.25 ||
      20;
    const rect = textarea.getBoundingClientRect();
    let charWidth = 8;
    try {
      const span = document.createElement("span");
      span.textContent = "M";
      span.style.fontFamily = style.fontFamily;
      span.style.fontSize = style.fontSize;
      span.style.position = "absolute";
      span.style.visibility = "hidden";
      span.style.whiteSpace = "pre";
      document.body.appendChild(span);
      const spanRect = span.getBoundingClientRect();
      if (spanRect.width > 0) {
        charWidth = spanRect.width;
      }
      document.body.removeChild(span);
    } catch {
      // fallback char width
    }
    const cols = Math.max(1, Math.floor(rect.width / charWidth));
    setInstructionEditorLineHeight(lineHeightPx);
    setInstructionEditorCols(cols);
  }, [showInstructionEditor, instructionEditorText]);

  useEffect(() => {
    if (!showInstructionEditor) return;
    if (Object.keys(instructionTemplates).length > 0) return;
    let cancelled = false;

    async function loadTemplates() {
      try {
        const res = await fetch("/api/config/instructions");
        if (!res.ok) {
          console.error(
            "Failed to load instruction templates:",
            await res.text()
          );
          return;
        }
        const data = (await res.json()) as {
          instructions?: Record<string, string[]>;
        };
        if (cancelled || !data.instructions) return;
        setInstructionTemplates(data.instructions);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load instruction templates:", err);
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [showInstructionEditor, instructionTemplates]);

  useEffect(() => {
    if (!showFunctionsJsonModal) return;
    let cancelled = false;
    async function loadToolTemplates() {
      try {
        const res = await fetch("/api/config/tools");
        if (!res.ok) {
          console.error("Failed to load tool templates:", await res.text());
          return;
        }
        const data = (await res.json()) as {
          tools?: {
            name: string;
            kind?: string | null;
            description?: string | null;
            definition?: any;
          }[];
        };
        if (cancelled || !data.tools) return;
        const templates = data.tools.map((tool) => ({
          name: tool.name,
          kind: tool.kind ?? null,
          description: tool.description ?? "",
          definition: tool.definition ?? {},
        }));
        if (!cancelled) {
          setAvailableToolTemplates(templates);
        }
      } catch (err) {
        console.error("Failed to load tool templates:", err);
      }
    }
    void loadToolTemplates();
    return () => {
      cancelled = true;
    };
  }, [showFunctionsJsonModal]);

  if (!assistantConfig) {
    return null;
  }

  const linesCount = instructionEditorLines.filter((l) => l.trim()).length;

  const sortedInstructions = useMemo(
    () =>
      [...assistantConfig.instructions].sort(
        (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
      ),
    [assistantConfig.instructions]
  );

  const enabledInstructions = sortedInstructions.filter(
    (inst) => inst.enabled
  );

  const totalInstructionLines = enabledInstructions.reduce(
    (sum, inst) =>
      sum + (Array.isArray(inst.lines) ? inst.lines.length : 0),
    0
  );

  async function reorderInstruction(
    instructionId: string,
    direction: "up" | "down"
  ) {
    if (sortedInstructions.length < 2) return;
    const currentIds = sortedInstructions.map((inst) => inst.id);
    const index = currentIds.indexOf(instructionId);
    if (index === -1) return;
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === currentIds.length - 1) return;

    const newOrder = [...sortedInstructions];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    const updates = newOrder.map((inst, sortIndex) => ({
      id: inst.id,
      enabled: inst.enabled,
      sortOrder: sortIndex,
    }));
    try {
      await updateInstructions(updates);
    } catch (err) {
      console.error("Failed to reorder instructions:", err);
    }
  }

  const enabledTools = assistantConfig.tools.filter((tool) => tool.enabled);

  const enabledRules = assistantConfig.sanitize
    .filter((rule) => rule.enabled)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const updatedAtLabel = useMemo(() => {
    if (!assistantConfig.assistant.updatedAt) return null;
    const date = new Date(assistantConfig.assistant.updatedAt);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }, [assistantConfig.assistant.updatedAt]);

  const BUILTIN_INSTRUCTION_TYPES = useMemo(
    () => [
      "identity",
      "tone_guidelines",
      "answer_policies",
      "tool_policies",
      "escalation_policies",
      "safety_rules"
    ],
    []
  );

  const INSTRUCTION_TYPE_DESCRIPTIONS: Record<string, string> = useMemo(
    () => ({
      identity:
        "Identity blocks define the core persona and role of the assistant.",
      tone_guidelines:
        "Tone guideline blocks describe the style, tone, and voice used in responses.",
      answer_policies:
        "Answer policy blocks specify how the assistant should structure and prioritize answers.",
      tool_policies:
        "Tool policy blocks explain how the assistant should use tools and when to call them.",
      escalation_policies:
        "Escalation policy blocks describe when and how to hand off to a human or another system.",
      safety_rules:
        "Safety rule blocks define safety constraints, disallowed content, and red lines.",
      custom:
        "Use a custom type when your block does not fit the built‑in categories.",
      default:
        "Select a type to better organize this instruction block and its purpose.",
    }),
    []
  );
  const [showInstructionEditorTypeMenu, setShowInstructionEditorTypeMenu] =
    useState(false);
  const [
    instructionEditorSelectedBuiltinType,
    setInstructionEditorSelectedBuiltinType,
  ] = useState<string | null>(null);
  const [
    instructionEditorCustomTypeMode,
    setInstructionEditorCustomTypeMode,
  ] = useState(false);

  const instructionEditorSelectedLabel = useMemo(() => {
    if (instructionEditorCustomTypeMode) {
      return instructionEditorType.trim() || "Custom type";
    }
    if (instructionEditorSelectedBuiltinType) {
      return instructionEditorSelectedBuiltinType;
    }
    return "Select type";
  }, [
    instructionEditorCustomTypeMode,
    instructionEditorSelectedBuiltinType,
    instructionEditorType,
  ]);

  const instructionEditorTypeMenuRef =
    useRef<HTMLDivElement | null>(null);

  const currentInstructionTypeDescription =
    instructionEditorCustomTypeMode
        ? INSTRUCTION_TYPE_DESCRIPTIONS.custom
        : instructionEditorSelectedBuiltinType &&
          INSTRUCTION_TYPE_DESCRIPTIONS[instructionEditorSelectedBuiltinType]
        ? INSTRUCTION_TYPE_DESCRIPTIONS[instructionEditorSelectedBuiltinType]
        : INSTRUCTION_TYPE_DESCRIPTIONS.default;

  const existingInstructionTypes = useMemo(
    () => new Set(sortedInstructions.map((inst) => inst.type)),
    [sortedInstructions]
  );

  const unusedBuiltinInstructionTypes = useMemo(
    () =>
      BUILTIN_INSTRUCTION_TYPES.filter(
        (type) => !existingInstructionTypes.has(type)
      ),
    [BUILTIN_INSTRUCTION_TYPES, existingInstructionTypes]
  );

  const availableBuiltinInstructionTypes = useMemo(() => {
    // Cuando editamos un bloque existente, mostramos siempre todos los tipos.
    if (editingInstructionId) {
      return BUILTIN_INSTRUCTION_TYPES;
    }
    // Al crear uno nuevo, si hay tipos libres mostramos solo los no usados.
    if (unusedBuiltinInstructionTypes.length > 0) {
      return unusedBuiltinInstructionTypes;
    }
    // Si ya están todos usados, mostramos la lista completa para no dejar
    // el desplegable vacío.
    return BUILTIN_INSTRUCTION_TYPES;
  }, [
    BUILTIN_INSTRUCTION_TYPES,
    editingInstructionId,
    unusedBuiltinInstructionTypes,
  ]);

  const selectedToolTemplate = useMemo(
    () =>
      selectedToolTemplateName
        ? availableToolTemplates.find(
            (tpl) => tpl.name === selectedToolTemplateName
          ) ?? null
        : null,
    [availableToolTemplates, selectedToolTemplateName]
  );

  const selectedToolTemplateLabel = useMemo(() => {
    if (functionsCustomMode) return "Custom function";
    if (selectedToolTemplateName) return selectedToolTemplateName;
    return "Select function";
  }, [functionsCustomMode, selectedToolTemplateName]);

  const selectedToolTemplateKindLabel = useMemo(() => {
    if (!selectedToolTemplate) return null;
    return selectedToolTemplate.kind ?? "function";
  }, [selectedToolTemplate]);

  const availableToolKinds = useMemo(() => {
    const kinds = new Set<string>();
    for (const tpl of availableToolTemplates) {
      if (tpl.kind && tpl.kind.trim()) {
        kinds.add(tpl.kind);
      }
    }
    if (!kinds.size) {
      kinds.add("function");
    }
    return Array.from(kinds);
  }, [availableToolTemplates]);

  const functionsJsonLines = useMemo(
    () => (functionsJsonText ? functionsJsonText.split("\n") : [""]),
    [functionsJsonText]
  );

  const functionsJsonHighlighted = useMemo(() => {
    const raw = functionsJsonText || "";

    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const KEY_COLOR = "#ec4899";
    const STRING_COLOR = "#10b981";
    const NUM_BOOL_COLOR = "#2563eb";
    const PUNCT_COLOR = "#f97316";

    let value: any;
    try {
      value = JSON.parse(raw);
    } catch {
      return escapeHtml(raw);
    }

    const indentUnit = "  ";

    const renderValue = (val: any, indent: number): string => {
      const pad = indentUnit.repeat(indent);
      if (Array.isArray(val)) {
        if (val.length === 0) return "[]";
        let out = "[\n";
        val.forEach((item, idx) => {
          out +=
            pad +
            indentUnit +
            renderValue(item, indent + 1) +
            (idx < val.length - 1
              ? `<span style="color:${PUNCT_COLOR};">,</span>\n`
              : "\n");
        });
        out += pad + "]";
        return out;
      }
      if (val && typeof val === "object") {
        const keys = Object.keys(val);
        if (keys.length === 0) return "{}";
        let out = "{\n";
        keys.forEach((key, idx) => {
          const keyHtml = `<span style="color:${KEY_COLOR};">"${escapeHtml(
            key
          )}"</span>`;
          out +=
            pad +
            indentUnit +
            keyHtml +
            `<span style="color:${PUNCT_COLOR};">: </span>` +
            renderValue(val[key], indent + 1) +
            (idx < keys.length - 1
              ? `<span style="color:${PUNCT_COLOR};">,</span>\n`
              : "\n");
        });
        out += pad + "}";
        return out;
      }
      if (typeof val === "string") {
        return `<span style="color:${STRING_COLOR};">"${escapeHtml(
          val
        )}"</span>`;
      }
      if (typeof val === "number") {
        return `<span style="color:${NUM_BOOL_COLOR};">${String(val)}</span>`;
      }
      if (typeof val === "boolean" || val === null) {
        return `<span style="color:${NUM_BOOL_COLOR};">${String(
          val
        )}</span>`;
      }
      return escapeHtml(String(val));
    };

    return renderValue(value, 0);
  }, [functionsJsonText]);


  useEffect(() => {
    if (!showInstructionEditorTypeMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const container = instructionEditorTypeMenuRef.current;
      if (!container) return;
      if (!container.contains(event.target as Node)) {
        setShowInstructionEditorTypeMenu(false);
      }
    };
    window.addEventListener("click", handleClickOutside, true);
    return () => {
      window.removeEventListener("click", handleClickOutside, true);
    };
  }, [showInstructionEditorTypeMenu]);

  return (
    <>
      <div
        className={`absolute inset-0 z-20 overflow-y-auto px-1 pt-3 pb-4 sm:px-2 md:px-4 ${
          isDark ? "bg-neutral-800 text-zinc-50" : "bg-white text-gray-900"
        }`}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Assistant
              </h2>
            </div>
            <button
              type="button"
              onClick={onSaveBasics}
              disabled={saving || loading || !assistantFormName.trim()}
              className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium ${
                saving || loading || !assistantFormName.trim()
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer"
              } ${
                isDark
                  ? "bg-white text-neutral-900 hover:bg-gray-100"
                  : "bg-black text-white hover:bg-neutral-900"
              }`}
            >
              {saving ? "Saving…" : "Update"}
            </button>
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/50 bg-red-950/40 px-4 py-3 text-xs text-red-100">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              <section className="space-y-1">
                <label
                  className={`block text-sm font-semibold ${
                    isDark ? "text-zinc-300" : "text-gray-700"
                  }`}
                >
                  Name
                </label>
                <input
                  type="text"
                  value={assistantFormName}
                  onChange={(e) => onChangeName(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2 text-sm outline-none ${
                    isDark
                      ? "border-zinc-800 bg-neutral-900 text-zinc-50 placeholder:text-zinc-500"
                      : "border-zinc-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                  placeholder="Name your assistant"
                />
              </section>

              <section className="space-y-1">
                <label
                  className={`block text-sm font-semibold ${
                    isDark ? "text-zinc-300" : "text-gray-700"
                  }`}
                >
                  Description
                </label>
                <textarea
                  value={assistantFormDescription}
                  onChange={(e) => onChangeDescription(e.target.value)}
                  className={`min-h-[72px] w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none ${
                    isDark
                      ? "border-zinc-800 bg-neutral-900 text-zinc-50 placeholder:text-zinc-500"
                      : "border-zinc-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                  placeholder="Add a short description about what this assistant does"
                />
              </section>

              <section className="space-y-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isDark ? "text-zinc-400" : "text-zinc-500"
                  }`}
                >
                  Instructions
                </h3>
                <div
                  className={`rounded-xl px-3 py-1 text-sm ${
                    isDark ? "bg-neutral-800" : "bg-white"
                  }`}
                >
                  {/* Header row */}
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-zinc-50" : "text-zinc-800"
                        }`}
                      >
                        Instructions
                      </span>
                      <Info className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingInstructionId(null);
                        setInstructionEditorType("");
                        setInstructionEditorLabel("");
                        setInstructionEditorText("");
                        setInstructionEditorSelectedBuiltinType(null);
                        setInstructionEditorCustomTypeMode(false);
                        setShowInstructionEditor(true);
                      }}
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium ${
                        isDark
                          ? "bg-neutral-800 text-zinc-50 hover:bg-neutral-700"
                          : "bg-zinc-100 text-gray-900 hover:bg-zinc-200"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Blocks</span>
                    </button>
                  </div>

                  {sortedInstructions.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <p className="text-xs text-gray-400">
                        {/* dark: subtle bluish hint similar to OpenAI */}
                        {totalInstructionLines}{" "}
                        {totalInstructionLines === 1
                          ? "instruction configured"
                          : "instructions configured"}
                      </p>
                      {sortedInstructions.map((inst, index) => {
                        const isFirst = index === 0;
                        const isLast =
                          index === sortedInstructions.length - 1;
                        return (
                        <div
                          key={inst.id}
                          draggable={sortedInstructions.length > 1}
                          onDragStart={(e) => {
                            setDragInstructionId(inst.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => {
                            if (!dragInstructionId || dragInstructionId === inst.id) {
                              return;
                            }
                            e.preventDefault();
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (!dragInstructionId || dragInstructionId === inst.id) {
                              return;
                            }
                            const items = [...sortedInstructions];
                            const fromIndex = items.findIndex(
                              (i) => i.id === dragInstructionId
                            );
                            const toIndex = items.findIndex(
                              (i) => i.id === inst.id
                            );
                            if (fromIndex === -1 || toIndex === -1) return;
                            const [moved] = items.splice(fromIndex, 1);
                            items.splice(toIndex, 0, moved);
                            const updates = items.map((item, idx) => ({
                              id: item.id,
                              enabled: item.enabled,
                              sortOrder: idx,
                            }));
                            void updateInstructions(updates);
                            setDragInstructionId(null);
                          }}
                          onDragEnd={() => {
                            setDragInstructionId(null);
                          }}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            isDark
                              ? "hover:bg-white/5"
                              : "hover:bg-zinc-50"
                          } ${inst.enabled ? "" : "opacity-50"}`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setEditingInstructionId(inst.id);
                              setInstructionEditorType(inst.type);
                              setInstructionEditorLabel(inst.label ?? "");
                              setInstructionEditorText(
                                Array.isArray(inst.lines)
                                  ? inst.lines.join("\n")
                                  : ""
                              );
                              const isBuiltin =
                                BUILTIN_INSTRUCTION_TYPES.includes(inst.type);
                              setInstructionEditorSelectedBuiltinType(
                                isBuiltin ? inst.type : null
                              );
                              setInstructionEditorCustomTypeMode(!isBuiltin);
                              setShowInstructionEditor(true);
                            }}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className="rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-gray-800"
                            >
                              {inst.type}
                            </span>
                            <span className="truncate text-[11px]">
                              {inst.label || inst.lines[0] || inst.type}
                            </span>
                          </button>
                          <div className="flex items-center gap-1">
                            {!isFirst && (
                              <Tooltip label="Move up">
                                <button
                                  type="button"
                                  onClick={() =>
                                    reorderInstruction(inst.id, "up")
                                  }
                                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                    isDark
                                      ? "text-gray-400 hover:bg-white/10"
                                      : "text-gray-500 hover:bg-zinc-100"
                                  }`}
                                  aria-label="Move instruction up"
                                >
                                  <ChevronUp className="h-3 w-3" />
                                </button>
                              </Tooltip>
                            )}
                            {!isLast && (
                              <Tooltip label="Move down">
                                <button
                                  type="button"
                                  onClick={() =>
                                    reorderInstruction(inst.id, "down")
                                  }
                                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                    isDark
                                      ? "text-gray-400 hover:bg-white/10"
                                      : "text-gray-500 hover:bg-zinc-100"
                                  }`}
                                  aria-label="Move instruction down"
                                >
                                  <ChevronDown className="h-3 w-3" />
                                </button>
                              </Tooltip>
                            )}
                            <Tooltip
                              label={
                                inst.enabled ? "Disable block" : "Enable block"
                              }
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  updateInstructions([
                                    {
                                      id: inst.id,
                                      enabled: !inst.enabled,
                                      sortOrder: inst.sortOrder,
                                    },
                                  ])
                                }
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                  isDark
                                    ? "text-gray-400 hover:bg-white/10"
                                    : "text-gray-500 hover:bg-zinc-100"
                                }`}
                                aria-label={
                                  inst.enabled
                                    ? "Disable instruction for this assistant"
                                    : "Enable instruction for this assistant"
                                }
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                            <Tooltip label="Delete block">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const res = await fetch(
                                      `/api/instructions/${inst.id}`,
                                      {
                                        method: "DELETE",
                                      }
                                    );
                                    if (!res.ok) {
                                      console.error(
                                        "Failed to delete instruction block:",
                                        await res.text()
                                      );
                                    }
                                  } catch (err) {
                                    console.error(
                                      "Failed to delete instruction block:",
                                      err
                                    );
                                  }
                                  setAssistantConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          instructions:
                                            prev.instructions.filter(
                                              (i) => i.id !== inst.id
                                            ),
                                        }
                                      : prev
                                  );
                                }}
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                  isDark
                                    ? "text-gray-400 hover:bg-white/10 hover:text-red-300"
                                    : "text-gray-500 hover:bg-zinc-100 hover:text-red-600"
                                }`}
                                aria-label="Remove instruction block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        </div>
                      );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isDark ? "text-gray-300" : "text-zinc-500"
                  }`}
                >
                  Tools
                </h3>
                <div
                  className={`rounded-xl px-3 py-1 text-sm ${
                    isDark ? "bg-neutral-800" : "bg-white"
                  }`}
                >
                  {/* File Search (coming soon) */}
                  <div
                    className={`flex items-center justify-between border-b py-3 text-sm ${
                      isDark ? "border-white/10" : "border-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 opacity-70">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-gray-200" : "text-zinc-600"
                        }`}
                      >
                        File Search
                      </span>
                      <Tooltip
                        label={
                          "File Search enables the assistant with knowledge from files that you or your users upload.\nOnce a file is uploaded, the assistant automatically decides when to retrieve content based on user requests."
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                          aria-label="File Search help"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                    <button
                      type="button"
                      disabled
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium opacity-60 cursor-not-allowed ${
                        isDark
                          ? "bg-neutral-800 text-gray-200"
                          : "bg-zinc-100 text-gray-700"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Files</span>
                    </button>
                  </div>

                  {/* Code interpreter (coming soon) */}
                  <div
                    className={`flex items-center justify-between border-b py-3 text-sm ${
                      isDark ? "border-white/10" : "border-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 opacity-70">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-gray-200" : "text-zinc-600"
                        }`}
                      >
                        Code interpreter
                      </span>
                      <Tooltip
                        label={
                          "Code Interpreter enables the assistant to write and run code.\nThis tool can process files with diverse data and formatting, and generate files such as graphs."
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                          aria-label="Code interpreter help"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                    <button
                      type="button"
                      disabled
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium opacity-60 cursor-not-allowed ${
                        isDark
                          ? "bg-neutral-800 text-gray-200"
                          : "bg-zinc-100 text-gray-700"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Files</span>
                    </button>
                  </div>

                  {/* Functions row + interactive tools */}
                  <div className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-gray-100" : "text-zinc-800"
                        }`}
                      >
                        Functions
                      </span>
                      <Tooltip
                        label={
                          "Function calling lets you describe custom functions of your app or external APIs to the assistant.\nThis allows the assistant to intelligently call those functions by outputting a JSON object containing relevant arguments."
                        }
                      >
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-white/10"
                          aria-label="Functions help"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </Tooltip>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setFunctionsJsonText("");
                        setFunctionsJsonError(null);
                        setFunctionsCustomMode(false);
                        setFunctionsEditingToolId(null);
                        setFunctionsEditingOwned(false);
                        setSelectedToolTemplateName(null);
                        setShowFunctionsTypeMenu(false);
                        setShowFunctionsKindMenu(false);
                        setShowFunctionsJsonModal(true);
                      }}
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium ${
                        isDark
                          ? "bg-neutral-800 text-gray-100 hover:bg-neutral-700"
                          : "bg-zinc-100 text-gray-900 hover:bg-zinc-200"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Functions</span>
                    </button>
                  </div>

                  {assistantConfig.tools.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {assistantConfig.tools.map((tool) => {
                        const toolKindLabel = tool.kind || "function";
                        return (
                          <div
                            key={tool.id}
                            className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                              isDark
                                ? "hover:bg-white/5"
                                : "hover:bg-zinc-50"
                            } ${tool.enabled ? "" : "opacity-50"}`}
                          >
                          <button
                            type="button"
                              className="flex flex-1 items-center gap-2 text-left"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    `/api/tools/${tool.id}`
                                  );
                                  if (!res.ok) {
                                    console.error(
                                      "Failed to load tool definition:",
                                      await res.text()
                                    );
                                    return;
                                  }
                                  const data = await res.json();
                                  const full = data.tool as {
                                    definition?: any;
                                  };
                                  if (full.definition) {
                                    setFunctionsJsonText(
                                      JSON.stringify(full.definition, null, 2)
                                    );
                                  } else {
                                    setFunctionsJsonText("");
                                  }
                                  setFunctionsJsonError(null);
                                  setFunctionsEditingToolId(tool.id);
                                  setFunctionsEditingOwned(tool.owned === true);
                                  setFunctionsCustomMode(tool.owned === true);
                                  setFunctionsOwnedKind(
                                    tool.kind || "business"
                                  );
                                  setSelectedToolTemplateName(
                                    tool.owned ? null : tool.name
                                  );
                                  setShowFunctionsTypeMenu(false);
                                  setShowFunctionsKindMenu(false);
                                  setShowFunctionsJsonModal(true);
                                } catch (err) {
                                  console.error(
                                    "Failed to load tool definition:",
                                    err
                                  );
                                }
                              }}
                            >
                            <SquareFunction
                                className={`h-4 w-4 flex-shrink-0 ${
                                  isDark ? "text-gray-300" : "text-gray-600"
                                }`}
                              />
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <span className="truncate text-[11px] font-mono">
                                  {tool.name}
                                </span>
                                <span className="flex-shrink-0 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-800">
                                  {toolKindLabel}
                                </span>
                              </div>
                            </button>
                            <Tooltip
                              label={
                                tool.enabled
                                  ? "Disable function"
                                  : "Enable function"
                              }
                            >
                              <button
                                type="button"
                                onClick={async () => {
                                  const nextEnabled = !tool.enabled;
                                  try {
                                    await updateTools([
                                      { id: tool.id, enabled: nextEnabled },
                                    ]);
                                  } catch (err) {
                                    console.error(
                                      "Failed to toggle function tool:",
                                      err
                                    );
                                    return;
                                  }
                                  setAssistantConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          tools: prev.tools.map((t) =>
                                            t.id === tool.id
                                              ? { ...t, enabled: nextEnabled }
                                              : t
                                          ),
                                        }
                                      : prev
                                  );
                                }}
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                  isDark
                                    ? tool.enabled
                                      ? "text-gray-300 hover:bg-white/10"
                                      : "text-gray-500 hover:bg-white/10"
                                    : tool.enabled
                                    ? "text-gray-500 hover:bg-zinc-100"
                                    : "text-gray-400 hover:bg-zinc-100"
                                }`}
                                aria-label={
                                  tool.enabled
                                    ? "Disable function"
                                    : "Enable function"
                                }
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                            <Tooltip label="Delete function">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!activeAssistantId) return;
                                  try {
                                    const res = await fetch(
                                      `/api/tools/${tool.id}`,
                                      {
                                        method: "DELETE",
                                        headers: {
                                          "Content-Type": "application/json",
                                        },
                                        body: JSON.stringify({
                                          assistantId: activeAssistantId,
                                        }),
                                      }
                                    );
                                    if (!res.ok) {
                                      console.error(
                                        "Failed to delete or unbind tool:",
                                        await res.text()
                                      );
                                      return;
                                    }
                                  } catch (err) {
                                    console.error(
                                      "Failed to delete or unbind tool:",
                                      err
                                    );
                                    return;
                                  }
                                  setAssistantConfig((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          tools: prev.tools.filter(
                                            (t) => t.id !== tool.id
                                          ),
                                        }
                                      : prev
                                  );
                                }}
                                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                                  isDark
                                    ? "text-gray-400 hover:bg-white/10 hover:text-red-300"
                                    : "text-gray-500 hover:bg-zinc-100 hover:text-red-600"
                                }`}
                                aria-label="Remove function tool from assistant"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </Tooltip>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>

              <section className="space-y-2">
                <h3
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isDark ? "text-gray-300" : "text-zinc-500"
                  }`}
                >
                  Sanitization rules
                </h3>
                <div
                  className={`rounded-xl px-3 py-1 text-sm ${
                    isDark ? "bg-neutral-800" : "bg-white"
                  }`}
                >
                  {/* Input (coming soon) */}
                  <div
                    className={`flex items-center justify-between border-b py-3 text-sm ${
                      isDark ? "border-white/10" : "border-zinc-100"
                    }`}
                  >
                    <div className="flex items-center gap-2 opacity-70">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-gray-200" : "text-zinc-600"
                        }`}
                      >
                        Input
                      </span>
                      <Info className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <button
                      type="button"
                      disabled
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium opacity-60 cursor-not-allowed ${
                        isDark
                          ? "bg-neutral-800 text-gray-200"
                          : "bg-zinc-100 text-gray-700"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Rules</span>
                    </button>
                  </div>

                  {/* Output sanitization */}
                  <div className="flex items-center justify-between py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isDark ? "text-gray-100" : "text-zinc-800"
                        }`}
                      >
                        Output
                      </span>
                      <Info className="h-3.5 w-3.5 text-zinc-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowRulesModal(true)}
                      className={`inline-flex items-center gap-1 rounded-2xl px-4 py-1.5 text-sm font-medium ${
                        isDark
                          ? "bg-neutral-800 text-gray-100 hover:bg-neutral-700"
                          : "bg-zinc-100 text-gray-900 hover:bg-zinc-200"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                      <span>Rules</span>
                    </button>
                  </div>

                  {enabledRules.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {enabledRules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                            isDark
                              ? "hover:bg-white/5"
                              : "hover:bg-zinc-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowRulesModal(true);
                            }}
                            className="flex flex-1 items-center gap-2 text-left"
                          >
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${
                                isDark
                                  ? "bg-gray-800 text-gray-200"
                                  : "bg-zinc-200 text-gray-800"
                              }`}
                            >
                              {rule.direction}
                            </span>
                            <span className="truncate text-[11px]">
                              {rule.description || "Unnamed rule"}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateSanitize([
                                { id: rule.id, enabled: false },
                              ])
                            }
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              isDark
                                ? "text-gray-400 hover:bg-white/10 hover:text-red-300"
                                : "text-gray-500 hover:bg-zinc-100 hover:text-red-600"
                            }`}
                            aria-label="Disable sanitization rule"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <div
                className={`mt-4 mb-1 flex items-center justify-between border-t pt-4 ${
                  isDark ? "border-white/10" : "border-zinc-200/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!activeAssistantId) return;
                      onDeleteAssistant(activeAssistantId);
                    }}
                    className={`flex h-9 w-9 items-center justify-center rounded-2xl text-sm transition-colors ${
                      isDark
                        ? "bg-neutral-700 text-gray-100 hover:bg-neutral-600"
                        : "bg-zinc-100 text-gray-900 hover:bg-zinc-200"
                    }`}
                    aria-label={t("chat.assistants.actions.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className={`inline-flex items-center gap-2 rounded-2xl px-4 h-9 text-sm font-medium transition-colors ${
                      isDark
                        ? "bg-neutral-700 text-gray-100 hover:bg-neutral-600"
                        : "bg-zinc-100 text-gray-900 hover:bg-zinc-200"
                    }`}
                  >
                    <Copy className="h-4 w-4" />
                    <span>{t("chat.assistants.actions.clone")}</span>
                  </button>
                </div>
                {updatedAtLabel && (
                  <span
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-zinc-500"
                    }`}
                  >
                    {t("chat.assistants.updatedPrefix")} {updatedAtLabel}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {showRulesModal && (
        <FullscreenPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowRulesModal(false);
              }
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-2xl border px-4 py-3 text-xs shadow-lg ${
                isDark
                  ? "border-white/10 bg-neutral-900 text-gray-100"
                  : "border-zinc-200 bg-white text-gray-900"
              }`}
            >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Sanitization rules</h2>
              <button
                type="button"
                onClick={() => setShowRulesModal(false)}
                className={`flex h-6 w-6 items-center justify-center rounded-full ${
                  isDark
                    ? "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
                    : "bg-zinc-200 text-gray-700 hover:bg-zinc-300"
                }`}
                aria-label="Close"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            <p className="mb-2 text-[11px] text-gray-400">
              Enable redact/replace rules to apply to assistant responses.
            </p>
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {assistantConfig.sanitize.map((rule) => (
                <label
                  key={rule.id}
                  className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    isDark
                      ? "border-neutral-800 bg-neutral-900 hover:border-sky-500/40"
                      : "border-zinc-200 bg-white hover:border-sky-500/60"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-3.5 w-3.5 rounded border-gray-600 bg-gray-900 text-sky-500 focus:ring-sky-500"
                    checked={rule.enabled}
                    onChange={() =>
                      updateSanitize([{ id: rule.id, enabled: !rule.enabled }])
                    }
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-gray-100">
                        {rule.description || "Rule"}
                      </span>
                      <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-300">
                        {rule.direction}
                      </span>
                    </div>
                  </div>
                </label>
              ))}
              {assistantConfig.sanitize.length === 0 && (
                <p className="text-[11px] text-gray-500">
                  No sanitization rules available.
                </p>
              )}
            </div>
            </div>
          </div>
        </FullscreenPortal>
      )}

      {showFunctionsJsonModal && (
        <FullscreenPortal>
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                setShowFunctionsJsonModal(false);
                setFunctionsJsonError(null);
                setShowFunctionsTypeMenu(false);
                setShowFunctionsKindMenu(false);
              }
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-[80vh] w-[90vw] max-w-4xl flex-col rounded-2xl border px-6 py-5 text-xs shadow-2xl ${
                isDark
                  ? "border-neutral-600 bg-neutral-800 text-gray-50"
                  : "border-zinc-200 bg-white text-gray-900"
              }`}
            >
              <div className="mb-4 flex items-center justify-between gap-2">
                <div className="flex flex-col gap-1">
                  <h2 className="text-sm font-semibold">
                    Function definition
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowFunctionsJsonModal(false);
                    setFunctionsJsonError(null);
                    setShowFunctionsTypeMenu(false);
                    setShowFunctionsKindMenu(false);
                  }}
                  className={`flex h-6 w-6 items-center justify-center rounded-full ${
                    isDark
                      ? "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
                      : "bg-zinc-200 text-gray-700 hover:bg-zinc-300"
                  }`}
                  aria-label="Close"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-[220px] flex-1 flex-col gap-2">
                  {functionsEditingOwned || (functionsCustomMode && !functionsEditingToolId) ? (
                    <div className="relative inline-flex">
                      <button
                        type="button"
                        onClick={() =>
                          setShowFunctionsKindMenu((prev) => !prev)
                        }
                        className="inline-flex items-center gap-1 rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-800 hover:bg-zinc-300 cursor-pointer"
                      >
                        <span>{functionsOwnedKind}</span>
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showFunctionsKindMenu && (
                        <div
                          className={`absolute left-0 top-7 z-[70] w-36 rounded-2xl border px-2 py-2 text-[11px] shadow-lg ${
                            isDark
                              ? "border-neutral-700 bg-neutral-900 text-gray-100"
                              : "border-gray-200 bg-white text-gray-900"
                          }`}
                        >
                          {availableToolKinds.map((kind) => (
                            <button
                              key={kind}
                              type="button"
                              onClick={() => {
                                setFunctionsOwnedKind(kind);
                                setShowFunctionsKindMenu(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                                isDark
                                  ? "hover:bg-neutral-800"
                                  : "hover:bg-gray-100"
                              }`}
                            >
                              <span className="text-[11px] font-medium">
                                {kind}
                              </span>
                              {functionsOwnedKind === kind && (
                                <Check className="h-3 w-3 text-gray-400" />
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    selectedToolTemplateKindLabel && (
                      <span className="inline-flex w-fit items-center rounded-md bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-800">
                        {selectedToolTemplateKindLabel}
                      </span>
                    )
                  )}
                </div>
                <div className="flex min-w-[220px] flex-col items-end gap-1">
                  <div className="relative inline-flex">
                    <button
                      type="button"
                      onClick={() => {
                        if (functionsEditingToolId) return;
                        setShowFunctionsTypeMenu((prev) => !prev);
                      }}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                        isDark
                          ? "bg-neutral-800 text-gray-200 hover:bg-neutral-700"
                          : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                      } ${
                        functionsEditingToolId ? "cursor-not-allowed opacity-60" : ""
                      }`}
                    >
                      <span className="truncate max-w-[160px] text-left">
                        {selectedToolTemplateLabel}
                      </span>
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    {showFunctionsTypeMenu && !functionsEditingToolId && (
                      <div
                        className={`absolute right-0 top-8 z-[70] w-60 rounded-2xl border px-2 py-2 text-[11px] shadow-lg ${
                          isDark
                            ? "border-neutral-700 bg-neutral-900 text-gray-100"
                            : "border-gray-200 bg-white text-gray-900"
                        }`}
                      >
                        {availableToolTemplates.map((tpl) => (
                          <button
                            key={tpl.name}
                            type="button"
                          onClick={() => {
                            setSelectedToolTemplateName(tpl.name);
                            setFunctionsCustomMode(false);
                            setShowFunctionsKindMenu(false);
                            setFunctionsJsonText(
                              JSON.stringify(tpl.definition, null, 2)
                            );
                            setFunctionsJsonError(null);
                            setShowFunctionsTypeMenu(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                              isDark
                                ? "hover:bg-neutral-800"
                                : "hover:bg-gray-100"
                            }`}
                          >
                            <span className="truncate text-[11px]">
                              {tpl.name}
                            </span>
                            {selectedToolTemplateName === tpl.name &&
                              !functionsCustomMode && (
                                <Check className="h-3 w-3 text-gray-400" />
                              )}
                          </button>
                        ))}
                        <div
                          className={`my-1 border-t ${
                            isDark
                              ? "border-neutral-800"
                              : "border-gray-200"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedToolTemplateName(null);
                            setFunctionsCustomMode(true);
                            setFunctionsOwnedKind("business");
                            setShowFunctionsKindMenu(false);
                            setFunctionsJsonError(null);
                            const template = {
                              name: "example",
                              description: "example...",
                              parameters: {
                                type: "object",
                                properties: {},
                              },
                              routes: {
                                method: "GET",
                                path: "/api/tools/example",
                              },
                            };
                            setFunctionsJsonText(
                              JSON.stringify(template, null, 2)
                            );
                            setShowFunctionsTypeMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                            isDark
                              ? "hover:bg-neutral-800"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <span className="text-[11px] font-medium">
                            Create from empty…
                          </span>
                          {functionsCustomMode && (
                            <Check className="h-3 w-3 text-gray-400" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div
                className={`mb-3 flex-1 overflow-hidden rounded-2xl border ${
                  isDark
                    ? "border-neutral-700 bg-neutral-900"
                    : "border-zinc-300 bg-white"
                }`}
              >
                <div className="flex h-full">
                  <div
                    ref={functionsJsonGutterRef}
                    className={`w-10 shrink-0 overflow-hidden border-r py-2 pr-2 text-right font-mono text-xs select-none ${
                      isDark
                        ? "border-neutral-700 bg-neutral-900/80 text-zinc-500"
                        : "border-gray-200 bg-gray-50 text-gray-500"
                    }`}
                  >
                    {functionsJsonLines.map((_, idx) => (
                      <div key={idx} className="leading-5">
                        {idx + 1}
                      </div>
                    ))}
                  </div>
                  <div className="relative flex-1">
                    <pre
                      ref={functionsJsonPreRef}
                      className="pointer-events-none absolute inset-0 overflow-auto px-3 py-2 font-mono text-[12px] leading-5 whitespace-pre"
                      dangerouslySetInnerHTML={{
                        __html: functionsJsonHighlighted,
                      }}
                    />
                    <textarea
                      value={functionsJsonText}
                      onChange={(e) => setFunctionsJsonText(e.target.value)}
                      onScroll={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        const pre = functionsJsonPreRef.current;
                        if (pre) {
                          pre.scrollTop = target.scrollTop;
                          pre.scrollLeft = target.scrollLeft;
                        }
                        const gutter = functionsJsonGutterRef.current;
                        if (gutter) {
                          gutter.scrollTop = target.scrollTop;
                        }
                      }}
                      readOnly={Boolean(
                        functionsEditingToolId && !functionsEditingOwned
                      )}
                      className="absolute inset-0 h-full w-full resize-none border-0 bg-transparent px-3 py-2 font-mono text-[12px] leading-5 text-transparent caret-black dark:caret-white outline-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={Boolean(
                    functionsJsonSaving ||
                      !functionsJsonText.trim() ||
                      (!functionsCustomMode &&
                        !selectedToolTemplateName &&
                        !functionsEditingToolId) ||
                      (!!functionsEditingToolId && !functionsEditingOwned)
                  )}
                  onClick={async () => {
                    try {
                      const parsed = JSON.parse(functionsJsonText || "{}");
                      setFunctionsJsonError(null);

                      if (!activeAssistantId) {
                        setFunctionsJsonError(
                          "Assistant id is required to add a function."
                        );
                        return;
                      }

                      const payload: any = {
                        assistantId: activeAssistantId,
                        ownerId: currentUserId,
                      };

                      if (functionsEditingToolId && functionsEditingOwned) {
                        // Update existing owned tool JSON
                        setFunctionsJsonSaving(true);
                        const res = await fetch(
                          `/api/tools/${functionsEditingToolId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              assistantId: activeAssistantId,
                              definition: parsed,
                              kind: functionsOwnedKind,
                            }),
                          }
                        );
                        if (!res.ok) {
                          const text = await res.text();
                          console.error("Failed to update tool:", text);
                          setFunctionsJsonError(
                            "Failed to update function definition."
                          );
                          return;
                        }
                        // Update local list (name/description) from JSON if present, and kind from selector
                        setAssistantConfig((prev) =>
                          prev
                            ? {
                                ...prev,
                                tools: prev.tools.map((t) => {
                                  if (t.id !== functionsEditingToolId) {
                                    return t;
                                  }
                                  const next = { ...t };
                                  if (
                                    parsed &&
                                    typeof parsed === "object"
                                  ) {
                                    if (
                                      typeof parsed.name === "string" &&
                                      parsed.name.trim()
                                    ) {
                                      next.name = parsed.name.trim();
                                    }
                                    if (
                                      typeof parsed.description ===
                                        "string" &&
                                      parsed.description.trim()
                                    ) {
                                      next.description =
                                        parsed.description.trim();
                                    }
                                  }
                                  return {
                                    ...next,
                                    kind: functionsOwnedKind,
                                  };
                                }),
                              }
                            : prev
                        );
                        setShowFunctionsJsonModal(false);
                        return;
                      }

                      if (functionsCustomMode && !functionsEditingToolId) {
                        if (
                          !parsed ||
                          typeof parsed !== "object" ||
                          typeof parsed.name !== "string" ||
                          !parsed.name.trim()
                        ) {
                          setFunctionsJsonError(
                            "Owned function JSON must include a non-empty \"name\" field."
                          );
                          return;
                        }
                        payload.definition = parsed;
                        payload.kind = functionsOwnedKind;
                      } else if (selectedToolTemplateName) {
                        payload.templateName = selectedToolTemplateName;
                      } else {
                        setFunctionsJsonError(
                          "Select a function template or switch to owned."
                        );
                        return;
                      }

                      setFunctionsJsonSaving(true);
                      const res = await fetch("/api/tools", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                      });
                      if (!res.ok) {
                        const text = await res.text();
                        console.error("Failed to add tool:", text);
                        try {
                          const parsedError = JSON.parse(text);
                          const msg =
                            typeof parsedError?.error === "string"
                              ? parsedError.error
                              : text || "Failed to add function.";
                          setFunctionsJsonError(msg);
                        } catch {
                          setFunctionsJsonError(
                            text || "Failed to add function."
                          );
                        }
                        return;
                      }
                      const data = await res.json();
                      const created = data.tool as {
                        id: string;
                        name: string;
                        kind: string | null;
                        description: string | null;
                        enabled: boolean;
                      };
                      setAssistantConfig((prev) =>
                        prev
                          ? {
                              ...prev,
                              tools: (() => {
                                const existingIndex = prev.tools.findIndex(
                                  (t) => t.id === created.id
                                );
                                if (existingIndex !== -1) {
                                  const next = [...prev.tools];
                                  next[existingIndex] = {
                                    ...next[existingIndex],
                                    enabled: created.enabled,
                                  };
                                  return next;
                                }
                                return [
                                  ...prev.tools,
                                  {
                                    id: created.id,
                                    name: created.name,
                                    kind: created.kind,
                                    description: created.description,
                                    enabled: created.enabled,
                                    owned:
                                      functionsCustomMode ||
                                      Boolean(selectedToolTemplateName),
                                  },
                                ];
                              })(),
                            }
                          : prev
                      );
                      setShowFunctionsJsonModal(false);
                    } catch (err: any) {
                      console.error("Failed to validate tool JSON:", err);
                      setFunctionsJsonError(
                        err instanceof Error ? err.message : "Invalid JSON"
                      );
                    } finally {
                      setFunctionsJsonSaving(false);
                    }
                  }}
                  className={`inline-flex items-center rounded-full px-4 py-1.5 text-sm font-medium ${
                    functionsJsonSaving ||
                    !functionsJsonText.trim() ||
                    (!functionsCustomMode &&
                      !selectedToolTemplateName &&
                      !functionsEditingToolId) ||
                    (functionsEditingToolId && !functionsEditingOwned)
                      ? "cursor-not-allowed opacity-60"
                      : "cursor-pointer"
                  } ${
                    isDark
                      ? "bg-gray-100 text-gray-900 hover:bg-white"
                      : "bg-black text-white hover:bg-neutral-900"
                  }`}
                >
                  {functionsEditingToolId ? "Update" : "Add"}
                </button>
              </div>
              {functionsJsonError && (
                <div className="mt-2 rounded-md bg-red-500/10 px-3 py-2 text-[11px] text-red-300">
                  {functionsJsonError}
                </div>
              )}
            </div>
          </div>
        </FullscreenPortal>
      )}

      {showInstructionEditor && (
        <FullscreenPortal>
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget && !instructionEditorSaving) {
                setShowInstructionEditor(false);
              }
            }}
          >
            <div
              onMouseDown={(e) => e.stopPropagation()}
              className={`flex h-[80vh] w-[90vw] max-w-4xl flex-col rounded-2xl border px-6 py-5 text-xs shadow-2xl ${
                isDark
                  ? "border-neutral-600 bg-neutral-800 text-zinc-50"
                  : "border-zinc-300 bg-zinc-50 text-gray-900"
              }`}
            >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <h2 className="text-sm font-semibold">
                  {editingInstructionId
                    ? "Edit instruction block"
                    : "New instruction block"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (instructionEditorSaving) return;
                  setShowInstructionEditor(false);
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isDark
                    ? "bg-neutral-800 text-gray-300 hover:bg-neutral-700"
                    : "bg-zinc-200 text-gray-700 hover:bg-zinc-300"
                }`}
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex flex-1 items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 md:hidden"
                  onClick={() =>
                    setShowInstructionTypeInfo((prev) => !prev)
                  }
                  aria-label="Instruction type info"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
                <div className="hidden items-start gap-1 text-[11px] text-gray-500 md:flex">
                  <Info className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
                  <p className="text-[11px] text-gray-500">
                    {currentInstructionTypeDescription}
                  </p>
                </div>
              </div>
              <div className="flex min-w-[160px] items-center justify-end">
                <div
                  ref={instructionEditorTypeMenuRef}
                  className="relative inline-flex"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setShowInstructionEditorTypeMenu((prev) => !prev)
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[11px] font-medium ${
                      isDark
                        ? "bg-neutral-800 text-gray-100 hover:bg-neutral-700"
                        : "bg-gray-100 text-gray-900 hover:bg-gray-200"
                    }`}
                  >
                    <span className="truncate max-w-[140px] text-left">
                      {instructionEditorSelectedLabel}
                    </span>
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showInstructionEditorTypeMenu && (
                    <div
                      className={`absolute right-0 top-8 z-[70] w-52 rounded-2xl border px-2 py-2 text-[11px] shadow-lg ${
                        isDark
                          ? "border-neutral-700 bg-neutral-900 text-gray-100"
                          : "border-gray-200 bg-white text-gray-900"
                      }`}
                    >
                      {availableBuiltinInstructionTypes.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setInstructionEditorSelectedBuiltinType(type);
                            setInstructionEditorCustomTypeMode(false);
                            setInstructionEditorType(type);
                            if (!editingInstructionId) {
                              const templateLines = instructionTemplates[type];
                              if (Array.isArray(templateLines)) {
                                setInstructionEditorText(
                                  templateLines.join("\n")
                                );
                              }
                            }
                            setShowInstructionEditorTypeMenu(false);
                          }}
                          className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                            isDark
                              ? "hover:bg-neutral-800"
                              : "hover:bg-gray-100"
                          }`}
                        >
                          <span className="font-mono text-[11px]">
                            {type}
                          </span>
                          {instructionEditorSelectedBuiltinType === type &&
                            !instructionEditorCustomTypeMode && (
                              <Check className="h-3 w-3 text-gray-400" />
                            )}
                        </button>
                      ))}
                      <div
                        className={`my-1 border-t ${
                          isDark ? "border-neutral-800" : "border-gray-200"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setInstructionEditorSelectedBuiltinType(null);
                          setInstructionEditorCustomTypeMode(true);
                          if (
                            !instructionEditorType ||
                            BUILTIN_INSTRUCTION_TYPES.includes(
                              instructionEditorType
                            )
                          ) {
                            setInstructionEditorType("");
                          }
                          // Al crear un bloque custom partimos de un lienzo en blanco.
                          setInstructionEditorText("");
                          setShowInstructionEditorTypeMenu(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-2 py-1.5 text-left ${
                          isDark
                            ? "hover:bg-neutral-800"
                            : "hover:bg-gray-100"
                        }`}
                      >
                        <span className="text-[11px] font-medium">
                          Create from empty…
                        </span>
                        {instructionEditorCustomTypeMode && (
                          <Check className="h-3 w-3 text-gray-400" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {instructionEditorCustomTypeMode && (
              <div className="mb-2">
                <input
                  type="text"
                  placeholder="identity, tone_guideline, safety..."
                  value={instructionEditorType}
                  onChange={(e) =>
                    setInstructionEditorType(e.target.value)
                  }
                  className={`w-full rounded-lg border px-2 py-1 text-[11px] outline-none ${
                    isDark
                      ? "border-neutral-700 bg-neutral-900 text-zinc-50 placeholder:text-zinc-500"
                      : "border-gray-300 bg-white text-gray-900 placeholder:text-gray-400"
                  }`}
                />
              </div>
            )}
            {showInstructionTypeInfo && !instructionEditorCustomTypeMode && (
              <div className="mb-3 w-full rounded-md bg-black px-3 py-2 text-[11px] font-medium text-white shadow-lg md:hidden">
                {currentInstructionTypeDescription}
              </div>
            )}

            <div
              className={`flex-1 overflow-hidden rounded-2xl border ${
                isDark
                  ? "border-neutral-700 bg-neutral-900"
                  : "border-zinc-300 bg-white"
              }`}
            >
              <div className="flex h-full">
                <div
                  ref={instructionEditorGutterRef}
                  className={`w-10 shrink-0 overflow-y-auto border-r py-2 pr-2 text-right font-mono text-sm select-none ${
                    isDark
                      ? "border-neutral-700 bg-neutral-900/80 text-zinc-500"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {instructionEditorLines.map((_, idx) => {
                    const rows =
                      instructionEditorRowsPerLine[idx] &&
                      instructionEditorLineHeight
                        ? instructionEditorRowsPerLine[idx]
                        : 1;
                    const height =
                      instructionEditorLineHeight && rows
                        ? instructionEditorLineHeight * rows
                        : undefined;
                    return (
                      <div
                        key={idx}
                        className="flex items-start justify-end pr-0.5 text-[11px]"
                        style={height ? { height } : undefined}
                      >
                        {idx + 1}
                      </div>
                    );
                  })}
                </div>
                <textarea
                  ref={instructionEditorTextareaRef}
                  value={instructionEditorText}
                  onChange={(e) => setInstructionEditorText(e.target.value)}
                  onScroll={(e) => {
                    const gutter = instructionEditorGutterRef.current;
                    if (gutter) {
                      gutter.scrollTop = (
                        e.target as HTMLTextAreaElement
                      ).scrollTop;
                    }
                  }}
                  className={`h-full w-full flex-1 resize-none overflow-auto bg-transparent px-3 py-2 font-mono text-sm leading-5 outline-none whitespace-pre-wrap ${
                    isDark ? "text-emerald-300" : "text-gray-900"
                  }`}
                  spellCheck={false}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="hidden text-[12px] text-gray-500 md:block">
                  Conversations with your assistant can potentially include part
                  or all of the instructions provided.
                </p>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:bg-black/5 md:hidden"
                  onClick={() =>
                    setShowInstructionFooterInfo((prev) => !prev)
                  }
                  aria-label="Instruction info"
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/*
                  Disable the primary action when there is no type selected
                  or when the block has no non-empty instruction lines.
                */}
                <button
                  type="button"
                  disabled={
                    instructionEditorSaving ||
                    !instructionEditorType.trim() ||
                    !instructionEditorText
                      .split("\n")
                      .some((l) => l.trim().length > 0)
                  }
                  onClick={async () => {
                    const trimmedType = instructionEditorType.trim();
                    const lines = instructionEditorText
                      .split("\n")
                      .map((l) => l.trim())
                      .filter((l) => l.length > 0);
                    if (!trimmedType || lines.length === 0) {
                      return;
                    }
                    try {
                      setInstructionEditorSaving(true);
                      if (editingInstructionId) {
                        const res = await fetch(
                          `/api/instructions/${editingInstructionId}`,
                          {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              type: trimmedType,
                              label: instructionEditorLabel.trim() || null,
                              lines,
                            }),
                          }
                        );
                        if (!res.ok) {
                          console.error(
                            "Failed to update instruction:",
                            await res.text()
                          );
                        } else {
                          setAssistantConfig((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  instructions: prev.instructions.map(
                                    (inst) =>
                                      inst.id === editingInstructionId
                                        ? {
                                            ...inst,
                                            type: trimmedType,
                                            label:
                                              instructionEditorLabel.trim() ||
                                              null,
                                            lines,
                                          }
                                        : inst
                                  ),
                                }
                              : prev
                          );
                        }
                      } else if (activeAssistantId) {
                        const res = await fetch("/api/instructions", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            type: trimmedType,
                            label: instructionEditorLabel.trim() || null,
                            lines,
                            assistantId: activeAssistantId,
                            ownerId: currentUserId,
                          }),
                        });
                        if (!res.ok) {
                          console.error(
                            "Failed to create instruction:",
                            await res.text()
                          );
                        } else {
                          const data = await res.json();
                          const created = data.instruction as {
                            id: string;
                            type: string;
                            label: string | null;
                            lines: string[];
                            status: string;
                          };
                          setAssistantConfig((prev) => {
                            if (!prev) return prev;
                            const existingIndex =
                              prev.instructions.findIndex(
                                (inst) => inst.id === created.id
                              );

                            // If the instruction already exists in this config,
                            // update it in-place. Otherwise append it and mark
                            // it as enabled with the next sort order.
                            if (existingIndex !== -1) {
                              const updatedInstructions = [
                                ...prev.instructions,
                              ];
                              updatedInstructions[existingIndex] = {
                                ...updatedInstructions[existingIndex],
                                type: created.type,
                                label: created.label,
                                lines: created.lines,
                              };
                              return {
                                ...prev,
                                instructions: updatedInstructions,
                              };
                            }

                            const nextSort =
                              prev.instructions.length > 0
                                ? prev.instructions.length
                                : 0;
                            const nextInstructions = [
                              ...prev.instructions,
                              {
                                id: created.id,
                                type: created.type,
                                label: created.label,
                                lines: created.lines,
                                enabled: true,
                                sortOrder: nextSort,
                              },
                            ];
                            void updateInstructions([
                              {
                                id: created.id,
                                enabled: true,
                                sortOrder: nextSort,
                              },
                            ]);
                            return {
                              ...prev,
                              instructions: nextInstructions,
                            };
                          });
                        }
                      }
                      setShowInstructionEditor(false);
                    } catch (err) {
                      console.error("Instruction editor error:", err);
                    } finally {
                      setInstructionEditorSaving(false);
                    }
                  }}
                  className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-medium ${
                    instructionEditorSaving ||
                    !instructionEditorType.trim() ||
                    !instructionEditorText
                      .split("\n")
                      .some((l) => l.trim().length > 0)
                      ? "cursor-not-allowed opacity-60"
                      : ""
                  } ${
                    isDark
                      ? "bg-zinc-100 text-zinc-900 hover:bg-white"
                      : "bg-black text-white hover:bg-neutral-900"
                  }`}
                >
                  {editingInstructionId ? "Update" : "Add"}
                </button>
              </div>
            </div>
            {showInstructionFooterInfo && (
              <div className="mt-2 w-full rounded-md bg-black px-3 py-2 text-[11px] font-medium text-white shadow-lg md:hidden">
                Conversations with your assistant can potentially include part
                or all of the instructions provided.
              </div>
            )}
            </div>
          </div>
        </FullscreenPortal>
      )}
    </>
  );
}
