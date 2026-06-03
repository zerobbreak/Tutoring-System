import type { PrivateFeedbackCategory } from "#/lib/private-session-feedback";
import type { PrivateSessionFeedbackDTO } from "#/server-actions/private-session-feedback/types";

function parseCategoryRatings(
  raw: unknown,
): Partial<Record<PrivateFeedbackCategory, number>> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<PrivateFeedbackCategory, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number" && value >= 1 && value <= 5) {
      out[key as PrivateFeedbackCategory] = value;
    }
  }
  return out;
}

export function mapFeedbackRow(row: {
  id: string;
  claim_id: string;
  tutor_id: string;
  author_id: string;
  category_ratings: unknown;
  note: string | null;
  created_at: string;
  updated_at: string;
  author?: { full_name: string } | { full_name: string }[] | null;
}): PrivateSessionFeedbackDTO {
  const authorRaw = row.author;
  const author = Array.isArray(authorRaw) ? authorRaw[0] : authorRaw;

  return {
    id: row.id,
    claimId: row.claim_id,
    tutorId: row.tutor_id,
    authorId: row.author_id,
    categoryRatings: parseCategoryRatings(row.category_ratings),
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: author ? { full_name: author.full_name } : null,
  };
}
