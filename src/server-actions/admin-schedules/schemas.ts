import { z } from "zod";

export const recurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  byWeekday: z.array(z.number().int().min(0).max(6)).min(1),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

export const calendarScopeSchema = z.enum([
  "institution",
  "module",
  "tutor",
  "lecturer",
]);

export const pageDataSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  academicTermId: z.string().uuid().nullable().optional(),
  scope: calendarScopeSchema.default("institution"),
  scopeEntityId: z.string().uuid().nullable().optional(),
});

export const issuesSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  academicTermId: z.string().uuid().nullable().optional(),
  scope: calendarScopeSchema.default("institution"),
  scopeEntityId: z.string().uuid().nullable().optional(),
});

export const createSeriesSchema = z.object({
  moduleId: z.string().uuid(),
  title: z.string().min(1).max(255),
  sessionKind: z.string().max(50).optional(),
  tutorId: z.string().uuid(),
  venueId: z.string().uuid().nullable().optional(),
  venueText: z.string().max(255).nullable().optional(),
  timezone: z.string().max(64).optional(),
  dtstart: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(24 * 60),
  recurrence: recurrenceSchema,
  academicTermId: z.string().uuid().nullable().optional(),
});

export const publishSeriesSchema = z.object({
  seriesId: z.string().uuid(),
});

export const assignTutorSchema = z.object({
  moduleId: z.string().uuid(),
  tutorId: z.string().uuid(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

export const reviewChangeSchema = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
});
