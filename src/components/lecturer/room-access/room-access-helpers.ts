import type { ScheduleEventDTO } from "#/server-actions/lecturer-schedule";
import type { VenueUnlockBoardItemDTO } from "#/server-actions/venue-unlock";

export function boardItemToScheduleEvent(
  item: VenueUnlockBoardItemDTO,
): ScheduleEventDTO {
  return {
    id: item.scheduledSessionId,
    seriesId: "",
    moduleId: "",
    moduleCode: item.moduleCode,
    moduleName: item.moduleName,
    title: item.title,
    tutorId: item.tutorId,
    tutorName: item.tutorName,
    startsAt: item.startsAt,
    endsAt: item.endsAt,
    venueName: item.venueName,
    venueText: item.venueName,
    status: item.sessionStatus,
    sessionKind: "tutorial",
    claimId: item.claimId,
    cancelledAt: null,
    cancellationReason: null,
  };
}

export function boardItemUnlockBadgeClass(
  status: VenueUnlockBoardItemDTO["status"],
): string {
  switch (status) {
    case "CLAIMED":
      return "bg-emerald-600 text-white";
    case "URGENT":
      return "bg-destructive text-white";
    case "PENDING":
      return "bg-amber-600 text-white";
    case "COMPLETED":
      return "bg-muted text-muted-foreground";
    case "CANCELLED":
    default:
      return "bg-muted text-muted-foreground";
  }
}
