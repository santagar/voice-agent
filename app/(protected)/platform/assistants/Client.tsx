"use client";

import { useMemo, useState } from "react";
import { useTheme } from "@/components/theme/ThemeContext";

type MockAssistant = {
  id: string;
  name: string;
  createdAt: string;
  model: string;
};

const EMPTY_STATE_ASSISTANTS: MockAssistant[] = [];

export default function AssistantsClientPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [assistants] = useState<MockAssistant[]>(EMPTY_STATE_ASSISTANTS);
  const [selectedAssistantId, setSelectedAssistantId] = useState<
    string | null
  >(null);

  const selectedAssistant = useMemo(
    () => assistants.find((a) => a.id === selectedAssistantId) ?? null,
    [assistants, selectedAssistantId],
  );

  const showEmptyState = assistants.length === 0;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1
            className={`text-lg font-semibold ${
              isDark ? "text-gray-50" : "text-zinc-900"
            }`}
          >
            Assistants
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Create and manage assistants for your workspace.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className={`rounded-full border px-3 py-1 ${
              isDark
                ? "border-neutral-700 text-gray-100 hover:bg-neutral-800"
                : "border-zinc-300 text-gray-800 hover:bg-zinc-50"
            }`}
          >
            Learn more
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1 font-semibold ${
              isDark
                ? "bg-white text-neutral-900 hover:bg-zinc-100"
                : "bg-black text-white hover:bg-neutral-900"
            }`}
          >
            + Create
          </button>
        </div>
      </div>

      <div className="mt-2 flex h-[calc(100vh-150px)] gap-4">
        <div
          className={`flex w-full max-w-md flex-col rounded-2xl border text-sm ${
            isDark
              ? "border-neutral-800 bg-neutral-900"
              : "border-zinc-200 bg-white"
          }`}
        >
          {showEmptyState ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full border text-xl ${
                  isDark
                    ? "border-neutral-700 bg-neutral-900 text-gray-300"
                    : "border-zinc-200 bg-zinc-50 text-zinc-500"
                }`}
              >
                🤖
              </div>
              <div>
                <p
                  className={`text-sm font-medium ${
                    isDark ? "text-gray-50" : "text-zinc-900"
                  }`}
                >
                  No assistants found
                </p>
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Create an assistant to get started with your Voice Agent
                  platform.
                </p>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs ${
                    isDark
                      ? "border-neutral-700 text-gray-100 hover:bg-neutral-800"
                      : "border-zinc-300 text-gray-800 hover:bg-zinc-50"
                  }`}
                >
                  Learn more
                </button>
                <button
                  type="button"
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isDark
                      ? "bg-white text-neutral-900 hover:bg-zinc-100"
                      : "bg-black text-white hover:bg-neutral-900"
                  }`}
                >
                  + Create
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col">
              <div className="border-b border-zinc-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-neutral-800 dark:text-zinc-400">
                Assistants
              </div>
              <ul className="flex-1 divide-y divide-zinc-200 overflow-y-auto text-sm dark:divide-neutral-800">
                {assistants.map((assistant) => {
                  const active = assistant.id === selectedAssistantId;
                  return (
                    <li key={assistant.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedAssistantId(assistant.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left ${
                          active
                            ? isDark
                              ? "bg-neutral-800 text-gray-50"
                              : "bg-zinc-900 text-zinc-50"
                            : isDark
                            ? "hover:bg-neutral-800 text-gray-200"
                            : "hover:bg-zinc-100 text-gray-800"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {assistant.name || "Untitled assistant"}
                          </span>
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {assistant.id}
                          </span>
                        </div>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">
                          {assistant.createdAt}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div
          className={`flex flex-1 flex-col rounded-2xl border text-sm ${
            isDark
              ? "border-neutral-800 bg-neutral-900"
              : "border-zinc-200 bg-white"
          }`}
        >
          {selectedAssistant ? (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold tracking-wide text-zinc-500 dark:text-zinc-400">
                    ASSISTANT
                  </h2>
                </div>
                <button
                  type="button"
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${
                    isDark
                      ? "border-neutral-700 text-gray-100 hover:bg-neutral-800"
                      : "border-zinc-300 text-gray-800 hover:bg-zinc-50"
                  }`}
                >
                  Edit
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Name
                  </label>
                  <input
                    type="text"
                    defaultValue={selectedAssistant.name}
                    className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm focus:outline-none ${
                      isDark
                        ? "border-neutral-700 bg-neutral-900 text-gray-100 placeholder:text-gray-500"
                        : "border-zinc-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                    placeholder="Enter a user friendly name"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {selectedAssistant.id}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    System instructions
                  </label>
                  <textarea
                    className={`mt-1 min-h-[120px] w-full resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none ${
                      isDark
                        ? "border-neutral-700 bg-neutral-900 text-gray-100 placeholder:text-gray-500"
                        : "border-zinc-300 bg-white text-gray-900 placeholder:text-gray-400"
                    }`}
                    placeholder="You are a helpful assistant..."
                  />
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Model
                  </label>
                  <select
                    className={`mt-1 h-9 w-full rounded-lg border px-3 text-sm focus:outline-none ${
                      isDark
                        ? "border-neutral-700 bg-neutral-900 text-gray-100"
                        : "border-zinc-300 bg-white text-gray-900"
                    }`}
                    defaultValue={selectedAssistant.model}
                  >
                    <option value="gpt-4.1">gpt-4.1</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8 text-sm text-zinc-500 dark:text-zinc-400">
              Select an assistant to view details
            </div>
          )}
        </div>
      </div>
    </>
  );
}
