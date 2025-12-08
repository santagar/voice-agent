export type ToolDefinition = {
  id?: string;
  name: string;
  kind?: "business" | "session";
  routes?: {
    method?: string;
    path?: string;
    [key: string]: unknown;
  };
  ui_command?: string;
  session_update?: Record<string, unknown>;
  description?: string;
  parameters?: {
    type: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
};

export type OpenAIToolDefinition = {
  type: "function";
  name: string;
  description: string;
  parameters: NonNullable<ToolDefinition["parameters"]>;
};
