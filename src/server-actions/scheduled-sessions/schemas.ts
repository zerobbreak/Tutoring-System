import { z } from "zod";

export const sessionActionSchema = z.object({
  sessionId: z.string().uuid(),
  reason: z.string().min(3).max(2000),
});

export const restoreSessionSchema = z.object({
  sessionId: z.string().uuid(),
});
