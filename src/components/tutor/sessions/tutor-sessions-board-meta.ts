import {
  closestCorners,
  pointerWithin,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

export const DROP_PREFIX = "kanban-drop:";

export const COLUMN_META: Record<
  SessionKanbanColumnId,
  {
    title: string;
    shortTitle: string;
    description: string;
    accentBorder: string;
    headerBg: string;
    countClass: string;
    emptyHint: string;
    headerIcon: LucideIcon;
    iconClass: string;
  }
> = {
  claimsPending: {
    title: "Awaiting approval",
    shortTitle: "Approval",
    description: "Session requests and claims in review",
    accentBorder: "border-t-amber-500",
    headerBg: "bg-amber-500/[0.06]",
    countClass: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
    emptyHint: "Nothing waiting on admin or your lecturer.",
    headerIcon: AlertTriangle,
    iconClass: "text-amber-700 dark:text-amber-300",
  },
  today: {
    title: "Today",
    shortTitle: "Today",
    description: "Deliver and capture attendance",
    accentBorder: "border-t-emerald-500",
    headerBg: "bg-emerald-500/[0.06]",
    countClass: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
    emptyHint: "No sessions on today's timetable.",
    headerIcon: ClipboardList,
    iconClass: "text-emerald-700 dark:text-emerald-300",
  },
  upcoming: {
    title: "Upcoming",
    shortTitle: "Upcoming",
    description: "Scheduled later — drag to reschedule",
    accentBorder: "border-t-lagoon-deep",
    headerBg: "bg-lagoon/[0.08]",
    countClass: "bg-lagoon/15 text-lagoon-deep",
    emptyHint: "Future sessions appear here.",
    headerIcon: CalendarRange,
    iconClass: "text-lagoon-deep",
  },
  completed: {
    title: "Past",
    shortTitle: "Past",
    description: "Finished teaching slots",
    accentBorder: "border-t-border",
    headerBg: "bg-muted/40",
    countClass: "bg-muted text-muted-foreground",
    emptyHint: "Completed sessions are archived here.",
    headerIcon: CheckCircle2,
    iconClass: "text-muted-foreground",
  },
};

export const SESSION_METRICS = [
  {
    label: "In view",
    key: "total" as const,
    icon: ClipboardList,
  },
  {
    label: "Needs review",
    key: "pendingClaims" as const,
    icon: AlertTriangle,
    tone: "amber" as const,
  },
  {
    label: "Attendance logged",
    key: "attendanceRate" as const,
    icon: CheckCircle2,
    tone: "emerald" as const,
    suffix: "%",
  },
  {
    label: "Upcoming",
    key: "upcomingSessions" as const,
    icon: CalendarRange,
    tone: "lagoon" as const,
  },
] as const;

export type SessionMetricsKey = (typeof SESSION_METRICS)[number]["key"];

/** Thematic stat shown under each board column legend tile. */
export const COLUMN_HIGHLIGHT: Partial<
  Record<
    SessionKanbanColumnId,
    {
      label: string;
      key: SessionMetricsKey;
      tone?: "amber" | "emerald" | "lagoon";
      suffix?: string;
    }
  >
> = {
  claimsPending: {
    label: "Needs review",
    key: "pendingClaims",
    tone: "amber",
  },
  today: {
    label: "Attendance logged",
    key: "attendanceRate",
    tone: "emerald",
    suffix: "%",
  },
  upcoming: {
    label: "Upcoming",
    key: "upcomingSessions",
    tone: "lagoon",
  },
};

export function resolveKanbanDropColumn(
  overId: string,
  columns: Record<SessionKanbanColumnId, TutorSessionClaimDTO[]>,
): SessionKanbanColumnId | null {
  if (overId.startsWith(DROP_PREFIX)) {
    return overId.slice(DROP_PREFIX.length) as SessionKanbanColumnId;
  }
  for (const colId of Object.keys(columns) as SessionKanbanColumnId[]) {
    if (columns[colId].some((c) => c.id === overId)) {
      return colId;
    }
  }
  return null;
}

/** Prefer column drop zones so empty lanes and headers register reliably. */
export const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    const dropZone = pointerHits.find((c) =>
      String(c.id).startsWith(DROP_PREFIX),
    );
    if (dropZone) return [dropZone];
    return pointerHits;
  }
  const cornerHits = closestCorners(args);
  const dropZone = cornerHits.find((c) =>
    String(c.id).startsWith(DROP_PREFIX),
  );
  if (dropZone) return [dropZone];
  return cornerHits;
};
