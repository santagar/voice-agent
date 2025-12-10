import { z } from "zod";

export const voiceIntentSchema = z.object({
  text: z.string().min(1, "'text' must be a non-empty string"),
});

export type VoiceIntentInput = z.infer<typeof voiceIntentSchema>;
