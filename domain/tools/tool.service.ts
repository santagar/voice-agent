import { OpenAIToolDefinition, ToolDefinition } from "./tool.types";
import { findActiveTools, findAssistantTools } from "./tool.repository";

export async function loadActiveToolDefinitions(): Promise<ToolDefinition[]> {
  const tools = await findActiveTools();
  return tools.map((t) => {
    const def: any = (t as any).definitionJson || {};
    const descriptionFromDef =
      typeof def.description === "string" && def.description.trim()
        ? def.description.trim()
        : "";
    const kind: ToolDefinition["kind"] =
      (t.kind as ToolDefinition["kind"]) === "session" ? "session" : "business";
    return {
      id: t.id,
      name: t.name,
      kind,
      routes: def.routes,
      ui_command: def.ui_command,
      session_update: def.session_update,
      description: descriptionFromDef,
      parameters:
        def.parameters || ({
          type: "object",
          properties: {},
        } as ToolDefinition["parameters"]),
    } satisfies ToolDefinition;
  });
}

export async function loadAssistantOpenAITools(
  assistantId: string
): Promise<OpenAIToolDefinition[]> {
  const bindings = await findAssistantTools(assistantId);
  return bindings.map((binding: any) => {
    const tool = binding.tool;
    const def: any = tool.definitionJson || {};
    return {
      type: "function",
      name: tool.name,
      description: tool.description || "",
      parameters:
        def.parameters || ({
          type: "object",
          properties: {},
        } as OpenAIToolDefinition["parameters"]),
    };
  });
}
