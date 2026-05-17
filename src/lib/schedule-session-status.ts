export type ScheduledSessionStatus =
  | "SCHEDULED"
  | "CANCELLED"
  | "RESCHEDULED";

export function isCancelledSessionStatus(
  status: string | null | undefined,
): boolean {
  return status === "CANCELLED";
}

export function scheduledSessionStatusLabel(status: string): string {
  switch (status) {
    case "CANCELLED":
      return "Cancelled";
    case "RESCHEDULED":
      return "Rescheduled";
    case "SCHEDULED":
      return "Scheduled";
    default:
      return status;
  }
}

export function scheduledSessionChipClass(status: string): string {
  if (status === "CANCELLED") {
    return "border-destructive/40 bg-destructive/10 text-destructive line-through decoration-destructive/60 opacity-80";
  }
  if (status === "RESCHEDULED") {
    return "border-amber-500/35 bg-amber-500/10 text-amber-950 dark:text-amber-100";
  }
  return "border-l-(--lagoon-deep) bg-(--lagoon-deep)/8 text-foreground hover:bg-(--lagoon-deep)/14";
}

export function scheduledSessionCardClass(status: string): string {
  if (status === "CANCELLED") {
    return "border-destructive/35 bg-destructive/5 opacity-90";
  }
  if (status === "RESCHEDULED") {
    return "border-amber-500/30 bg-amber-500/5";
  }
  return "border-border/80 bg-card";
}
