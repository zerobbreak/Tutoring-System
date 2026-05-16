import { z } from "zod";

export const sessionFiltersSchema = z.object({
  lookbackDays: z.number().int().min(7).max(365).default(30),
  moduleId: z.string().uuid().nullable().optional(),
  tutorId: z.string().uuid().nullable().optional(),
  lecturerId: z.string().uuid().nullable().optional(),
});

export const claimIdSchema = z.object({
  claimId: z.string().uuid(),
});
