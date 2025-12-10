import { z } from "zod";

export const transcribeSchema = z.object({
  audio: z.string().min(1, "'audio' must be a base64 string"),
});

export type TranscribeInput = z.infer<typeof transcribeSchema>;