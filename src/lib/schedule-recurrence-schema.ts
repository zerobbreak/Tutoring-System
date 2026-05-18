import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const weeklyRecurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  byWeekday: z.array(z.number().int().min(0).max(6)).min(1),
  until: isoDateSchema.nullable(),
});

export const explicitDatesRecurrenceSchema = z.object({
  frequency: z.literal("explicit_dates"),
  dates: z.array(isoDateSchema).min(1),
});

export const recurrenceSchema = z.discriminatedUnion("frequency", [
  weeklyRecurrenceSchema,
  explicitDatesRecurrenceSchema,
]);
