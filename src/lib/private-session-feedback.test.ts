import { describe, expect, it } from "vitest";
import {
  hasFeedbackContent,
  normalizeCategoryRatings,
  upsertPrivateFeedbackInputSchema,
} from "#/lib/private-session-feedback";

describe("upsertPrivateFeedbackInputSchema", () => {
  const claimId = "550e8400-e29b-41d4-a716-446655440000";

  it("rejects empty payload", () => {
    const result = upsertPrivateFeedbackInputSchema.safeParse({
      claimId,
    });
    expect(result.success).toBe(false);
  });

  it("accepts partial category ratings", () => {
    const result = upsertPrivateFeedbackInputSchema.safeParse({
      claimId,
      categoryRatings: { PREPAREDNESS: 4, STUDENT_ENGAGEMENT: 5 },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(normalizeCategoryRatings(result.data.categoryRatings)).toEqual({
        PREPAREDNESS: 4,
        STUDENT_ENGAGEMENT: 5,
      });
    }
  });

  it("accepts note-only feedback", () => {
    const result = upsertPrivateFeedbackInputSchema.safeParse({
      claimId,
      note: "Strong engagement throughout the session.",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(
        hasFeedbackContent(
          normalizeCategoryRatings(result.data.categoryRatings),
          result.data.note,
        ),
      ).toBe(true);
    }
  });

  it("rejects ratings outside 1–5", () => {
    const result = upsertPrivateFeedbackInputSchema.safeParse({
      claimId,
      categoryRatings: { PROFESSIONALISM: 6 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes over 2000 characters", () => {
    const result = upsertPrivateFeedbackInputSchema.safeParse({
      claimId,
      note: "x".repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});
