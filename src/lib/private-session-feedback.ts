import * as z from "zod";

export const PRIVATE_FEEDBACK_CATEGORIES = [
  "PREPAREDNESS",
  "STUDENT_ENGAGEMENT",
  "ATTENDANCE_MANAGEMENT",
  "PROFESSIONALISM",
  "SESSION_EFFECTIVENESS",
] as const;

export type PrivateFeedbackCategory = (typeof PRIVATE_FEEDBACK_CATEGORIES)[number];

export const PRIVATE_FEEDBACK_CATEGORY_LABELS: Record<
  PrivateFeedbackCategory,
  string
> = {
  PREPAREDNESS: "Preparedness",
  STUDENT_ENGAGEMENT: "Student engagement",
  ATTENDANCE_MANAGEMENT: "Attendance management",
  PROFESSIONALISM: "Professionalism",
  SESSION_EFFECTIVENESS: "Session effectiveness",
};

const ratingSchema = z.number().int().min(1).max(5);

export const categoryRatingsSchema = z
  .object({
    PREPAREDNESS: ratingSchema.optional(),
    STUDENT_ENGAGEMENT: ratingSchema.optional(),
    ATTENDANCE_MANAGEMENT: ratingSchema.optional(),
    PROFESSIONALISM: ratingSchema.optional(),
    SESSION_EFFECTIVENESS: ratingSchema.optional(),
  })
  .strict();

export type CategoryRatingsInput = z.infer<typeof categoryRatingsSchema>;

export const upsertPrivateFeedbackInputSchema = z
  .object({
    claimId: z.string().uuid(),
    categoryRatings: categoryRatingsSchema.optional(),
    note: z.string().trim().max(2000).optional(),
  })
  .superRefine((data, ctx) => {
    const ratings = data.categoryRatings ?? {};
    const hasRating = Object.values(ratings).some((v) => v != null);
    const hasNote = Boolean(data.note?.trim());
    if (!hasRating && !hasNote) {
      ctx.addIssue({
        code: "custom",
        message: "Add at least one category rating or a short note.",
        path: ["note"],
      });
    }
  });

export const ELIGIBLE_FEEDBACK_CLAIM_STATUSES = ["VERIFIED", "APPROVED"] as const;

export function normalizeCategoryRatings(
  input: CategoryRatingsInput | undefined,
): Record<string, number> {
  if (!input) return {};
  const out: Record<string, number> = {};
  for (const key of PRIVATE_FEEDBACK_CATEGORIES) {
    const value = input[key];
    if (value != null) out[key] = value;
  }
  return out;
}

export function hasFeedbackContent(
  ratings: Record<string, number>,
  note: string | null | undefined,
): boolean {
  return Object.keys(ratings).length > 0 || Boolean(note?.trim());
}

export function assertClaimEligibleForPrivateFeedback(claim: {
  status: string;
}): void {
  if (
    !ELIGIBLE_FEEDBACK_CLAIM_STATUSES.includes(
      claim.status as (typeof ELIGIBLE_FEEDBACK_CLAIM_STATUSES)[number],
    )
  ) {
    throw new Error(
      "Private feedback is only available after a session has been verified.",
    );
  }
}
