import type { VenueUnlockStatus } from "#/lib/venue-access";

export type VenueUnlockBoardItemDTO = {
  unlockRequestId: string;
  scheduledSessionId: string;
  status: VenueUnlockStatus;
  claimedById: string | null;
  claimedByName: string | null;
  claimedAt: string | null;
  urgentAt: string | null;
  moduleCode: string;
  moduleName: string;
  title: string;
  tutorId: string;
  tutorName: string;
  venueId: string | null;
  venueName: string | null;
  startsAt: string;
  endsAt: string;
  sessionStatus: string;
  claimId: string | null;
};

export type TutorVenueUnlockStatusDTO = {
  scheduledSessionId: string;
  status: VenueUnlockStatus | null;
  claimedByName: string | null;
  venueName: string | null;
  startsAt: string;
  canPing: boolean;
};

export type VenueUnlockAccessDTO = {
  canAccess: boolean;
  canUnlockVenues: boolean;
};
