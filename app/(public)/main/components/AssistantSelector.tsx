"use client";

import React from "react";
import { SquarePen } from "lucide-react";
import { SelectMenu } from "@/components/front/ui/SelectMenu";
import { useRouter } from "next/navigation";

export type AssistantSummary = {
  id: string;
  name: string;
  description?: string | null;
  createdAt?: string;
};

type AssistantSelectorProps = {
  isDark: boolean;
  loggedIn: boolean;
  assistants: AssistantSummary[];
  activeAssistantId: string | null;
  onChangeAssistant: (id: string) => void;
  disabled?: boolean;
  t: (key: string) => string;
};

export function AssistantSelector({
  isDark,
  loggedIn,
  assistants,
  activeAssistantId,
  onChangeAssistant,
  disabled,
  t,
}: AssistantSelectorProps) {
  const router = useRouter();

  const assistantOptions =
    assistants.length > 0
      ? assistants
      : [{ id: "default", name: "Voice Agent" }];

  const selectedId =
    activeAssistantId &&
    assistantOptions.some((a) => a.id === activeAssistantId)
      ? activeAssistantId
      : assistantOptions[0]?.id ?? null;

  const selectedAssistant =
    assistantOptions.find((a) => a.id === selectedId) ?? assistantOptions[0];

  const baseOptions = assistantOptions.map((a) => ({
    value: a.id,
    label: a.name,
    description: a.description ?? undefined,
  }));

  const selectOptions =
    loggedIn && selectedAssistant
      ? [
          ...baseOptions,
          {
            value: "__assistant_editor_sep__",
            label: "",
            kind: "separator" as const,
          },
          {
            value: "__assistant_editor__",
            label: t("chat.assistants.openEditor"),
            description: t("chat.assistants.openEditorHelper"),
            kind: "action" as const,
            iconLeft: (
              <SquarePen
                className={`h-4 w-4 ${
                  isDark ? "text-gray-100" : "text-gray-800"
                }`}
              />
            ),
          },
        ]
      : baseOptions;

  if (disabled) {
    return (
      <div
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
          isDark
            ? "bg-transparent text-gray-100"
            : "bg-transparent text-gray-800"
        }`}
      >
        <span className="truncate text-lg">
          {selectedAssistant?.name ?? "Voice Agent"}
        </span>
      </div>
    );
  }

  return (
    <SelectMenu
      isDark={isDark}
      value={selectedId ?? ""}
      options={selectOptions}
      align="left"
      triggerClassName={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium cursor-pointer ${
        isDark
          ? "bg-transparent text-gray-100"
          : "bg-transparent text-gray-800"
      }`}
      labelClassName="truncate text-lg"
      onChange={(id) => {
        if (!id) return;
        if (id === "__assistant_editor__") {
          if (selectedAssistant?.id) {
            router.push(`/a/editor/${selectedAssistant.id}`);
          }
          return;
        }
        onChangeAssistant(id);
      }}
    />
  );
}
