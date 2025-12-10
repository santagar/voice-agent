import { z } from "zod";

export const createSessionSchema = z.object({
  userId: z.string().nullable().optional(),
  assistantId: z.string().min(1, "assistantId is required"),
  conversationId: z.string().nullable().optional(),
  channel: z.string().optional(),
  assistantConfig: z.any().nullable().optional(),
});

export const updateSessionSchema = z
  .object({
    status: z
      .union([z.literal("closed"), z.literal("expired"), z.literal("active")])
      .optional(),
    conversationId: z.string().nullable().optional(),
    userId: z.string().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "No valid fields to update",
  });

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
