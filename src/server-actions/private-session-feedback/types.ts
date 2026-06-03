import type { PrivateFeedbackCategory } from "#/lib/private-session-feedback";

export type PrivateSessionFeedbackDTO = {
  id: string;
  claimId: string;
  tutorId: string;
  authorId: string;
  categoryRatings: Partial<Record<PrivateFeedbackCategory, number>>;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  author: { full_name: string } | null;
};

export type TutorPrivateFeedbackListItemDTO = PrivateSessionFeedbackDTO & {
  moduleCode: string;
  moduleName: string;
  sessionDate: string;
};
