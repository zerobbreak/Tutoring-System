import { z } from "zod";
import { AUDIT_FEED_CATEGORIES } from "./types";

export const listAuditFeedSchema = z.object({
  actorId: z.string().uuid().nullable().optional(),
  moduleId: z.string().uuid().nullable().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  category: z.enum(AUDIT_FEED_CATEGORIES).default("ALL"),
  limit: z.number().int().min(1).max(200).default(100),
});
