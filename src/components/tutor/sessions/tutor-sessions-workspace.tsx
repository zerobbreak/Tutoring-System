import {
  closestCorners,
  DndContext,
  DragOverlay,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { format, parseISO, startOfDay } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardList,
  FileWarning,
  GripVertical,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  StickyNote,
  Table2,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Calendar } from "#/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ScrollArea, ScrollBar } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { TooltipProvider } from "#/components/ui/tooltip";
import { StudentCardScanner } from "#/components/tutor/attendance/student-card-scanner";
import { PrivateSessionFeedbackReadBlock } from "#/components/private-session-feedback/private-session-feedback-read-block";
import { SubmitClaimDialog } from "#/components/tutor/sessions/submit-claim-dialog";
import { canTutorScanAttendanceForClaim } from "#/lib/session-attendance-open";
import {
  sessionBoundsLocal,
  sessionKanbanColumn,
  type ClaimStatus,
  type SessionKanbanColumnId,
} from "#/lib/session-kanban-column";
import { fileToBase64 } from "#/lib/file-base64";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import type { TutorHourBudgetSummary } from "#/lib/tutor-hour-budget";
import { getTutorHourBudgetFn } from "#/server-actions/tutor-allocations";
import { cn } from "#/lib/utils";
import {
  SESSION_REQUEST_STATUS,
  sessionRequestStatusLabel,
} from "#/lib/session-request-status";
import {
  createSessionClaimFn,
  deleteDraftSessionClaimFn,
  deleteDraftSessionClaimsFn,
  getAttendanceDataFn,
  listTutorModuleAssignmentsFn,
  listTutorSessionClaimsFn,
  registerAttendanceEvidenceFn,
  scanStudentForSessionFn,
  resubmitSessionRequestFn,
  updateSessionClaimSchedulingFn,
  type AttendanceRecordDTO,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

const DROP_PREFIX = "kanban-drop:";

const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
];

const COLUMN_META: Record<
  SessionKanbanColumnId,
  {
    title: string;
    description: string;
    accentBorder: string;
    headerBg: string;
    countClass: string;
    emptyHint: string;
  }
> = {
  claimsPending: {
    title: "Pending",
    description: "Session requests and claims awaiting review",
    accentBorder: "border-t-amber-500",
    headerBg: "bg-gradient-to-b from-amber-500/8 to-transparent",
    countClass: "bg-amber-500/15 text-amber-900 dark:text-amber-100",
    emptyHint: "No claims in review right now.",
  },
  today: {
    title: "Today's sessions",
    description: "On your timetable today",
    accentBorder: "border-t-emerald-500",
    headerBg: "bg-gradient-to-b from-emerald-500/8 to-transparent",
    countClass: "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100",
    emptyHint: "Nothing scheduled for today.",
  },
  upcoming: {
    title: "Upcoming",
    description: "Scheduled ahead",
    accentBorder: "border-t-[var(--lagoon-deep)]",
    headerBg: "bg-gradient-to-b from-lagoon/10 to-transparent",
    countClass: "bg-lagoon/15 text-lagoon-deep",
    emptyHint: "Drag sessions here or create one below.",
  },
  completed: {
    title: "Completed",
    description: "Already delivered",
    accentBorder: "border-t-border",
    headerBg: "bg-gradient-to-b from-muted/50 to-transparent",
    countClass: "bg-muted text-muted-foreground",
    emptyHint: "Finished sessions land here.",
  },
};

const SESSION_STAT_CARDS = [
  {
    label: "Total sessions",
    key: "total" as const,
    icon: ClipboardList,
    cardClass: "border-border/70 bg-card/80",
    iconWrap: "bg-muted text-muted-foreground",
    valueClass: "",
  },
  {
    label: "Pending claims",
    key: "pendingClaims" as const,
    icon: AlertTriangle,
    cardClass: "border-amber-500/25 bg-amber-500/5",
    iconWrap: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    valueClass: "text-amber-700 dark:text-amber-300",
  },
  {
    label: "Attendance coverage",
    key: "attendanceRate" as const,
    icon: CheckCircle2,
    cardClass: "border-emerald-500/25 bg-emerald-500/5",
    iconWrap: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    valueClass: "text-emerald-700 dark:text-emerald-300",
    suffix: "%",
  },
  {
    label: "Upcoming sessions",
    key: "upcomingSessions" as const,
    icon: CalendarRange,
    cardClass: "border-lagoon/30 bg-lagoon/5",
    iconWrap: "bg-lagoon/15 text-lagoon-deep",
    valueClass: "",
  },
] as const;

function claimStatusRail(status: ClaimStatus): string {
  switch (status) {
    case "APPROVED":
    case "VERIFIED":
      return "border-l-emerald-500";
    case "PENDING_VERIFICATION":
      return "border-l-amber-500";
    case "DISPUTED":
    case "REJECTED":
      return "border-l-destructive";
    default:
      return "border-l-muted-foreground/30";
  }
}

function claimTimes(claim: TutorSessionClaimDTO) {
  return {
    start: claim.start_time ?? "09:00",
    end: claim.end_time ?? "10:00",
  };
}

function isSessionLive(claim: TutorSessionClaimDTO, now: Date): boolean {
  const times = claimTimes(claim);
  const { start, end } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  return now >= start && now <= end;
}

function isSessionUrgent(claim: TutorSessionClaimDTO, now: Date): boolean {
  if (claim.status === "DISPUTED" || claim.status === "REJECTED") return true;
  const times = claimTimes(claim);
  const { start } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  const ms = start.getTime() - now.getTime();
  if (ms <= 0 || ms > 2 * 60 * 60 * 1000) return false;
  return true;
}

function resolveKanbanDropColumn(
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
const kanbanCollisionDetection: CollisionDetection = (args) => {
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

function KanbanDragOverlay({ claim }: { claim: TutorSessionClaimDTO }) {
  const mod = claim.module;
  const status = claim.status as ClaimStatus;
  return (
    <Card
      className={cn(
        "w-[min(300px,calc(100vw-2rem))] cursor-grabbing border-l-[3px] bg-card shadow-2xl ring-2 ring-lagoon-deep/20",
        claimStatusRail(status),
      )}
    >
      <CardHeader className="gap-2 p-4 pb-2">
        {mod?.code ? (
          <span className="w-fit rounded-md bg-lagoon/10 px-2 py-0.5 text-[10px] font-bold tracking-wide text-lagoon-deep uppercase">
            {mod.code}
          </span>
        ) : null}
        <CardTitle className="text-sm leading-snug font-semibold">
          {mod?.name ?? "Unknown module"}
        </CardTitle>
        <CardDescription className="text-xs">
          {format(parseISO(`${claim.session_date}T12:00:00`), "EEE d MMM")}{" "}
          · {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <Badge variant={claimBadgeVariant(status)}>
          {claimBadgeLabel(status)}
        </Badge>
      </CardContent>
    </Card>
  );
}

function DroppableColumn({
  id,
  children,
  className,
}: {
  id: SessionKanbanColumnId;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${DROP_PREFIX}${id}`,
    disabled: id === "claimsPending",
    data: { columnId: id },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-muted/15 shadow-sm transition-all duration-200",
        COLUMN_META[id].accentBorder,
        "border-t-[3px]",
        isOver &&
          id !== "claimsPending" &&
          "border-lagoon-deep/60 bg-lagoon/8 shadow-md ring-1 ring-lagoon-deep/15",
        className,
      )}
    >
      {children}
    </div>
  );
}

function DraggableSessionCard({
  claim,
  columnId,
  onOpen,
  onQr,
  onUpload,
  onAttendance,
  onSubmit,
  onWorkspace,
  onDiscard,
  onEditRequest,
  draftSelectMode,
  draftSelected,
  onToggleDraftSelect,
  now,
}: {
  claim: TutorSessionClaimDTO;
  columnId: SessionKanbanColumnId;
  onOpen: () => void;
  onQr: () => void;
  onUpload: () => void;
  onAttendance: () => void;
  onSubmit: () => void;
  onWorkspace: () => void;
  onDiscard: () => void;
  onEditRequest?: () => void;
  draftSelectMode: boolean;
  draftSelected: boolean;
  onToggleDraftSelect: () => void;
  now: Date;
}) {
  const reduceMotion = useReducedMotion();
  const isDraft = claim.status === "DRAFT";
  const pendingRequest =
    claim.request_status === SESSION_REQUEST_STATUS.PENDING ||
    claim.request_status === SESSION_REQUEST_STATUS.CHANGES_REQUESTED ||
    claim.request_status === SESSION_REQUEST_STATUS.REJECTED;
  const canWorkSession = !pendingRequest;
  const dragDisabled = columnId === "claimsPending" || draftSelectMode || pendingRequest;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: claim.id,
      disabled: dragDisabled,
      data: { columnId },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const mod = claim.module;
  const status = claim.status as ClaimStatus;
  const lecturerName = mod?.lecturer?.full_name ?? "Lecturer";
  const initials = lecturerName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const expected = claim.attendance_expected_count;
  const present = claim.attendance_present_count;
  const hasHeadcount =
    expected != null && expected > 0 && present != null && present >= 0;
  const progressRatio = hasHeadcount
    ? Math.min(1, (present as number) / (expected as number))
    : claim.evidenceCount > 0
      ? 1
      : 0;
  const progressLabel = hasHeadcount
    ? `${present}/${expected} students`
    : claim.evidenceCount > 0
      ? "Register on file"
      : "Attendance —";

  const progressPct = Math.round(progressRatio * 100);
  const live = isSessionLive(claim, now);
  const urgent = isSessionUrgent(claim, now);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout={!reduceMotion && !isDragging}
      initial={false}
      animate={
        reduceMotion
          ? undefined
          : { opacity: isDragging ? 0.35 : 1, scale: isDragging ? 0.98 : 1 }
      }
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className={cn(isDragging && "relative z-0")}
    >
      <Card
        className={cn(
          "group/card cursor-pointer border-l-[3px] bg-card shadow-sm transition-all hover:shadow-md",
          claimStatusRail(status),
          urgent && "ring-1 ring-amber-500/20",
          live && "ring-1 ring-emerald-500/25",
          draftSelectMode && draftSelected && "ring-2 ring-lagoon-deep/40",
        )}
        onClick={() => {
          if (draftSelectMode && isDraft) {
            onToggleDraftSelect();
            return;
          }
          onOpen();
        }}
      >
        <CardHeader className="gap-2 p-3 pb-2">
          <div className="flex items-start gap-2">
            {draftSelectMode && isDraft ? (
              <label
                className="mt-0.5 flex shrink-0 cursor-pointer items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={draftSelected}
                  onChange={onToggleDraftSelect}
                  className="size-4 rounded border-input accent-[var(--lagoon-deep)]"
                  aria-label={`Select ${mod?.code ?? "session"} draft`}
                />
              </label>
            ) : null}
            {!dragDisabled ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md bg-muted/60 p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label="Drag to reschedule"
                onClick={(e) => e.stopPropagation()}
                {...listeners}
                {...attributes}
              >
                <GripVertical className="size-3.5" />
              </button>
            ) : (
              <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-muted/40 p-1.5 text-muted-foreground/35">
                <GripVertical className="size-3.5" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {live ? (
                  <Badge variant="success" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <CircleDot className="size-3" />
                    Live
                  </Badge>
                ) : null}
                {urgent && !live ? (
                  <Badge variant="warning" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <AlertTriangle className="size-3" />
                    Urgent
                  </Badge>
                ) : null}
                {mod?.code ? (
                  <span className="rounded bg-lagoon/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-lagoon-deep uppercase">
                    {mod.code}
                  </span>
                ) : null}
                {pendingRequest ? (
                  <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                    {sessionRequestStatusLabel(
                      claim.request_status as
                        | "PENDING"
                        | "CHANGES_REQUESTED"
                        | "REJECTED"
                        | "APPROVED"
                        | null,
                    )}
                  </Badge>
                ) : null}
              </div>
              <CardTitle className="line-clamp-2 text-sm leading-snug font-semibold">
                {mod?.name ?? "Unknown module"}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">
                  {format(parseISO(`${claim.session_date}T12:00:00`), "EEE d MMM")}
                </span>
                {" · "}
                {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
                {claim.venue ? (
                  <span className="text-muted-foreground"> · {claim.venue}</span>
                ) : null}
              </p>
              {claim.review_feedback ? (
                <p className="mt-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs text-amber-900 dark:text-amber-100">
                  {claim.review_feedback}
                </p>
              ) : null}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  className="shrink-0 opacity-70 group-hover/card:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onWorkspace}>
                  Open session
                </DropdownMenuItem>
                {onEditRequest ? (
                  <DropdownMenuItem onSelect={onEditRequest}>
                    Update request
                  </DropdownMenuItem>
                ) : null}
                {canWorkSession ? (
                  <>
                    <DropdownMenuItem onSelect={onUpload}>
                      Upload register
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onQr}>Generate QR</DropdownMenuItem>
                    <DropdownMenuItem onSelect={onAttendance}>
                      View attendance
                    </DropdownMenuItem>
                  </>
                ) : null}
                {claim.status === "DRAFT" && canWorkSession ? (
                  <DropdownMenuItem onSelect={onSubmit}>
                    Submit claim
                  </DropdownMenuItem>
                ) : null}
                {claim.status === "DRAFT" && !pendingRequest ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={onDiscard}
                    >
                      <Trash2 className="size-4" />
                      Discard draft
                    </DropdownMenuItem>
                  </>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to="/tutor/notes"
                    search={{ claim: claim.id, focus: Date.now() }}
                  >
                    Add notes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/tutor/messaging"
                    search={
                      mod?.lecturer_id
                        ? { lecturer: mod.lecturer_id }
                        : undefined
                    }
                  >
                    Message lecturer
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-3 pt-0 pb-3">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{progressLabel}</span>
              {hasHeadcount || claim.evidenceCount > 0 ? (
                <span className="font-semibold tabular-nums text-foreground">
                  {progressPct}%
                </span>
              ) : null}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progressPct >= 100
                    ? "bg-emerald-500"
                    : progressPct > 0
                      ? "bg-lagoon-deep"
                      : "bg-transparent",
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-7 shrink-0 border border-border/60">
                <AvatarFallback className="text-[9px] font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-foreground">
                  {lecturerName}
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={claimBadgeVariant(status)}
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {claimBadgeLabel(status)}
                  </Badge>
                  {claim.evidenceCount > 0 ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <CheckCircle2 className="size-3 text-emerald-600" />
                      Evidence
                    </span>
                  ) : null}
                  {(claim.notes?.trim() || claim.topics_covered?.trim()) && (
                    <StickyNote className="size-3 text-lagoon-deep" aria-hidden />
                  )}
                </div>
              </div>
            </div>
            {isDraft ? (
              <Button
                type="button"
                size="xs"
                className="shrink-0 gap-1.5"
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmit();
                }}
              >
                <Send className="size-3.5" />
                Submit claim
              </Button>
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover/card:translate-x-0.5 group-hover/card:text-lagoon-deep" />
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

type SessionsSearch = { claim?: string };

type TutorSessionsWorkspaceProps = {
  search: SessionsSearch;
  navigate: (opts: {
    to: string;
    search?: Record<string, unknown>;
    replace?: boolean;
  }) => void | Promise<void>;
};

export function TutorSessionsWorkspace({
  search,
  navigate,
}: TutorSessionsWorkspaceProps) {
  const reduceMotion = useReducedMotion();

  const [claims, setClaims] = useState<TutorSessionClaimDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickOpen, setDatePickOpen] = useState(false);
  const [datePickTemp, setDatePickTemp] = useState<Date | undefined>(undefined);
  const [statusFilters, setStatusFilters] = useState<Set<ClaimStatus>>(
    () => new Set(ALL_STATUSES),
  );
  const [workspaceTab, setWorkspaceTab] = useState<"kanban" | "table">("kanban");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailClaim, setDetailClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [qrOpen, setQrOpen] = useState(false);
  const [qrClaim, setQrClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadClaim, setUploadClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceClaim, setAttendanceClaim] =
    useState<TutorSessionClaimDTO | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<
    AttendanceRecordDTO[] | null
  >(null);
  const [attendanceScanning, setAttendanceScanning] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitClaim, setSubmitClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [modules, setModules] = useState<
    Awaited<ReturnType<typeof listTutorModuleAssignmentsFn>>
  >([]);
  const [createModuleId, setCreateModuleId] = useState<string>("");
  const [createDate, setCreateDate] = useState<Date>(() => new Date());
  const [createStart, setCreateStart] = useState("09:00");
  const [createEnd, setCreateEnd] = useState("10:00");
  const [createVenue, setCreateVenue] = useState("");
  const [createSessionKind, setCreateSessionKind] = useState("tutorial");
  const [createRequestReason, setCreateRequestReason] = useState("");
  const [resubmitClaimId, setResubmitClaimId] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardTargetIds, setDiscardTargetIds] = useState<string[]>([]);
  const [discardBusy, setDiscardBusy] = useState(false);
  const [draftSelectMode, setDraftSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [hourBudget, setHourBudget] = useState<TutorHourBudgetSummary | null>(
    null,
  );

  const [activeDrag, setActiveDrag] = useState<{
    claim: TutorSessionClaimDTO;
    columnId: SessionKanbanColumnId;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);


  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTutorSessionClaimsFn();
      setClaims(rows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load teaching sessions",
      );
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void getTutorHourBudgetFn()
      .then(setHourBudget)
      .catch(() => setHourBudget(null));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  const loadAttendanceForClaim = useCallback(async (claimId: string) => {
    const rows = await getAttendanceDataFn({ data: { claimId } });
    setAttendanceRows(rows);
  }, []);

  const attendanceScanEnabled = useMemo(() => {
    if (!attendanceClaim) return false;
    return canTutorScanAttendanceForClaim({
      attendance_locked_at: attendanceClaim.attendance_locked_at,
      session_date: attendanceClaim.session_date,
      start_time: attendanceClaim.start_time,
      end_time: attendanceClaim.end_time,
    });
  }, [attendanceClaim]);

  const handleAttendanceScan = useCallback(
    async (payload: string) => {
      if (!attendanceClaim) return;
      setAttendanceScanning(true);
      try {
        const result = await scanStudentForSessionFn({
          data: { claimId: attendanceClaim.id, payload },
        });
        if (result.alreadyPresent) {
          toast.info(`${result.studentName} is already marked present.`);
        } else if (result.registered) {
          toast.success(
            `${result.studentName} registered and marked present.`,
          );
        } else {
          toast.success(`${result.studentName} marked present.`);
        }
        await loadAttendanceForClaim(attendanceClaim.id);
        void reload();
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Could not record attendance",
        );
      } finally {
        setAttendanceScanning(false);
      }
    },
    [attendanceClaim, loadAttendanceForClaim, reload],
  );

  const openDiscard = (claimIds: string[]) => {
    if (claimIds.length === 0) return;
    setDiscardTargetIds(claimIds);
    setDiscardOpen(true);
  };

  const exitDraftSelectMode = () => {
    setDraftSelectMode(false);
    setSelectedDraftIds(new Set());
  };

  const toggleDraftSelected = (claimId: string) => {
    setSelectedDraftIds((prev) => {
      const next = new Set(prev);
      if (next.has(claimId)) next.delete(claimId);
      else next.add(claimId);
      return next;
    });
  };

  useEffect(() => {
    if (!search.claim || claims.length === 0) return;
    const hit = claims.find((c) => c.id === search.claim);
    if (hit) {
      setDetailClaim(hit);
      setDetailOpen(true);
    }
  }, [search.claim, claims]);

  const openResubmitRequest = (claim: TutorSessionClaimDTO) => {
    setResubmitClaimId(claim.id);
    setCreateModuleId(claim.module_id);
    setCreateDate(parseISO(`${claim.session_date}T12:00:00`));
    setCreateStart(formatClock(claim.start_time) || "09:00");
    setCreateEnd(formatClock(claim.end_time) || "10:00");
    setCreateVenue(claim.venue ?? "");
    setCreateSessionKind(claim.session_kind ?? "tutorial");
    setCreateRequestReason(claim.request_reason ?? "");
    setCreateOpen(true);
  };

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        const m = await listTutorModuleAssignmentsFn();
        setModules(m);
        if (!resubmitClaimId) {
          setCreateModuleId((prev) => prev || m[0]?.moduleId || "");
        }
      } catch {
        setModules([]);
      }
    })();
  }, [createOpen, resubmitClaimId]);

  const moduleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of claims) {
      if (c.module) map.set(c.module.id, `${c.module.code} — ${c.module.name}`);
    }
    return [...map.entries()];
  }, [claims]);

  const filteredClaims = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return claims.filter((c) => {
      if (!statusFilters.has(c.status)) return false;
      if (moduleFilter !== "all" && c.module_id !== moduleFilter) return false;
      if (dateFilter && c.session_date !== format(dateFilter, "yyyy-MM-dd"))
        return false;
      if (!q) return true;
      const blob = [
        c.module?.code,
        c.module?.name,
        c.venue,
        c.session_kind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [claims, searchText, moduleFilter, dateFilter, statusFilters]);

  const visibleDrafts = useMemo(
    () => filteredClaims.filter((c) => c.status === "DRAFT"),
    [filteredClaims],
  );

  const tableSortedClaims = useMemo(
    () =>
      [...filteredClaims].sort((a, b) => {
        if (a.session_date !== b.session_date) {
          return a.session_date < b.session_date ? 1 : -1;
        }
        const ta = `${a.start_time ?? "00:00"}`;
        const tb = `${b.start_time ?? "00:00"}`;
        return tb.localeCompare(ta);
      }),
    [filteredClaims],
  );

  useEffect(() => {
    const draftIds = new Set(
      claims.filter((c) => c.status === "DRAFT").map((c) => c.id),
    );
    setSelectedDraftIds((prev) => {
      const next = new Set([...prev].filter((id) => draftIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [claims]);

  const columns = useMemo(() => {
    const buckets: Record<SessionKanbanColumnId, TutorSessionClaimDTO[]> = {
      claimsPending: [],
      today: [],
      upcoming: [],
      completed: [],
    };
    for (const c of filteredClaims) {
      if (
        c.request_status === SESSION_REQUEST_STATUS.PENDING ||
        c.request_status === SESSION_REQUEST_STATUS.CHANGES_REQUESTED ||
        c.request_status === SESSION_REQUEST_STATUS.REJECTED
      ) {
        buckets.claimsPending.push(c);
        continue;
      }
      const times = claimTimes(c);
      const col = sessionKanbanColumn(
        now,
        c.session_date,
        times.start,
        times.end,
        c.status,
      );
      buckets[col].push(c);
    }
    const sortFn = (a: TutorSessionClaimDTO, b: TutorSessionClaimDTO) => {
      const da = `${a.session_date}T${formatClock(a.start_time)}:00`;
      const db = `${b.session_date}T${formatClock(b.start_time)}:00`;
      return da.localeCompare(db);
    };
    for (const k of Object.keys(buckets) as SessionKanbanColumnId[]) {
      buckets[k].sort(sortFn);
    }
    return buckets;
  }, [filteredClaims, now]);

  const stats = useMemo(() => {
    const total = filteredClaims.length;
    const pendingClaims = filteredClaims.filter((c) =>
      ["DRAFT", "PENDING_VERIFICATION", "DISPUTED", "REJECTED"].includes(c.status),
    ).length;
    const withEvidence = filteredClaims.filter((c) => c.evidenceCount > 0).length;
    const attendanceRate =
      total === 0 ? 0 : Math.round((withEvidence / total) * 1000) / 10;
    const upcomingSessions = filteredClaims.filter(
      (c) =>
        (() => {
          const times = claimTimes(c);
          return sessionKanbanColumn(
            now,
            c.session_date,
            times.start,
            times.end,
            c.status,
          );
        })() === "upcoming",
    ).length;
    return { total, pendingClaims, attendanceRate, upcomingSessions };
  }, [filteredClaims, now]);

  const toggleStatus = (s: ClaimStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return new Set(ALL_STATUSES);
      return next;
    });
  };

  const closeDetailSearch = () => {
    setDetailOpen(false);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: undefined },
      replace: true,
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    const claim = claims.find((c) => c.id === String(event.active.id));
    const columnId = event.active.data.current?.columnId as
      | SessionKanbanColumnId
      | undefined;
    if (claim && columnId) {
      setActiveDrag({ claim, columnId });
    }
  };

  const clearActiveDrag = () => setActiveDrag(null);

  const onDragEnd = async (event: DragEndEvent) => {
    clearActiveDrag();
    const { active, over } = event;
    if (!over) return;
    const from = active.data.current?.columnId as SessionKanbanColumnId | undefined;
    const to = resolveKanbanDropColumn(String(over.id), columns);
    if (!from || !to || from === "claimsPending" || to === "claimsPending") return;
    if (from === to) return;
    if (to !== "today" && to !== "upcoming" && to !== "completed") return;
    try {
      const { session_date } = await updateSessionClaimSchedulingFn({
        data: { claimId: String(active.id), targetColumn: to },
      });
      toast.success(
        `Session moved to ${COLUMN_META[to].title.toLowerCase()} (${session_date})`,
      );
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  };

  const onDragCancel = () => {
    clearActiveDrag();
  };

  const openWorkspace = (c: TutorSessionClaimDTO) => {
    setDetailClaim(c);
    setDetailOpen(true);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: c.id },
      replace: true,
    });
  };

  const onWorkspaceTabChange = (value: string) => {
    setWorkspaceTab(value === "table" ? "table" : "kanban");
  };

  const sessionQrValue =
    typeof window !== "undefined" && qrClaim
      ? `${window.location.origin}/tutor/sessions?claim=${qrClaim.id}`
      : "";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 space-y-4 border-b border-border/60 p-3 sm:space-y-5 sm:p-4 md:p-6 lg:p-8">
          <header className="flex min-w-0 gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-lagoon/10 text-lagoon-deep sm:size-11">
              <Video className="size-5 sm:size-6" aria-hidden />
            </span>
            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl md:text-3xl">
                Sessions workspace
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground">
                Operational hub for live teaching: attendance, claims, registers,
                and quick hand-offs to notes or messaging.
              </p>
            </div>
          </header>

          {hourBudget && hourBudget.totals.allocatedHours > 0 ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                hourBudget.totals.availableHours < 0
                  ? "border-destructive/40 bg-destructive/5 text-destructive"
                  : "border-border/70 bg-muted/20 text-muted-foreground",
              )}
            >
              <span className="font-medium text-foreground">Hour allocation: </span>
              {hourBudget.totals.reservedHours}h reserved of{" "}
              {hourBudget.totals.allocatedHours}h
              {hourBudget.totals.availableHours >= 0
                ? ` (${hourBudget.totals.availableHours}h available)`
                : ` (${Math.abs(hourBudget.totals.availableHours)}h over cap)`}
              . Worked: {hourBudget.totals.workedHours}h.
            </div>
          ) : null}

          <div className="rounded-xl border border-border/70 bg-muted/15 p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-4">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search sessions..."
                className="w-full pl-9"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:flex sm:flex-wrap lg:col-span-1 lg:justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Module
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onSelect={() => setModuleFilter("all")}>
                    All modules
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {moduleOptions.map(([id, label]) => (
                    <DropdownMenuItem key={id} onSelect={() => setModuleFilter(id)}>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Date
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem onSelect={() => setDateFilter(undefined)}>
                    Any date
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setDateFilter(startOfDay(new Date()))}
                  >
                    Today only
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setDatePickTemp(dateFilter ?? new Date());
                      setDatePickOpen(true);
                    }}
                  >
                    Pick date…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={datePickOpen} onOpenChange={setDatePickOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter by date</DialogTitle>
                    <DialogDescription>
                      Only sessions on this day are shown in the board and stats.
                    </DialogDescription>
                  </DialogHeader>
                  <Calendar
                    mode="single"
                    selected={datePickTemp}
                    onSelect={setDatePickTemp}
                    className="mx-auto rounded-md border p-2"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDatePickOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (datePickTemp) setDateFilter(datePickTemp);
                        setDatePickOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Claim status
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Visible statuses</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_STATUSES.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={statusFilters.has(s)}
                      onCheckedChange={() => toggleStatus(s)}
                    >
                      {claimBadgeLabel(s)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {visibleDrafts.length > 0 ? (
                <Button
                  type="button"
                  variant={draftSelectMode ? "secondary" : "outline"}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => {
                    if (draftSelectMode) exitDraftSelectMode();
                    else setDraftSelectMode(true);
                  }}
                >
                  <CheckSquare className="size-4" />
                  {draftSelectMode ? "Cancel" : "Select drafts"}
                </Button>
              ) : null}
            </div>
            </div>

          {draftSelectMode && visibleDrafts.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-lagoon-deep/25 bg-lagoon/5 px-3 py-2 text-sm">
              <span className="font-medium text-foreground">
                {selectedDraftIds.size} of {visibleDrafts.length} selected
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSelectedDraftIds(new Set(visibleDrafts.map((c) => c.id)))
                }
              >
                Select all visible
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedDraftIds(new Set())}
              >
                Clear
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="ml-auto gap-1.5"
                disabled={selectedDraftIds.size === 0}
                onClick={() => openDiscard([...selectedDraftIds])}
              >
                <Trash2 className="size-4" />
                Discard selected
              </Button>
            </div>
          ) : null}

          {dateFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Filtered to {format(dateFilter, "d MMM yyyy")} ·{" "}
                <button
                  type="button"
                  className="font-medium text-lagoon-deep underline-offset-2 hover:underline"
                  onClick={() => setDateFilter(undefined)}
                >
                  Clear date
                </button>
              </span>
            </div>
          ) : null}

          <ScrollArea className="w-full mt-4">
            <div className="flex gap-3 pb-3 min-w-max lg:grid lg:grid-cols-4 lg:min-w-0 lg:pb-0">
              {SESSION_STAT_CARDS.map((card) => {
                const { label, key, icon: Icon, cardClass, iconWrap, valueClass } = card;
                const suffix = "suffix" in card ? card.suffix : undefined;
                const raw = stats[key];
                const display =
                  loading ? "—" : suffix ? `${raw}${suffix}` : String(raw);
                  return (
                    <Card
                      key={key}
                      className={cn("w-[230px] shrink-0 shadow-sm transition-shadow hover:shadow-md lg:w-auto", cardClass)}
                    >
                      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                        <div className="min-w-0 space-y-1">
                          <CardDescription className="text-xs">{label}</CardDescription>
                          <CardTitle
                            className={cn("text-2xl tabular-nums tracking-tight", valueClass)}
                          >
                            {display}
                          </CardTitle>
                        </div>
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            iconWrap,
                          )}
                        >
                          <Icon className="size-4" aria-hidden />
                        </span>
                      </CardHeader>
                    </Card>
                  );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-3 pb-4 sm:px-4 md:px-6 lg:px-8">
          <Tabs
            value={workspaceTab}
            onValueChange={onWorkspaceTabChange}
            className="flex min-h-0 flex-1 flex-col pt-4"
          >
            <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3">
              <TabsList className="h-10 gap-0.5 p-1">
                <TabsTrigger value="kanban" className="h-8 gap-1.5 px-4">
                  <LayoutGrid className="size-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="table" className="h-8 gap-1.5 px-4">
                  <Table2 className="size-4" />
                  Table
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent
              value="kanban"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              {loading ? (
                <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[420px] rounded-xl" />
                  ))}
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={kanbanCollisionDetection}
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                  onDragCancel={onDragCancel}
                >
                  <div className="flex h-full min-h-[280px] gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:gap-4 2xl:grid 2xl:grid-cols-4 2xl:gap-4 2xl:overflow-visible 2xl:pb-0">
                  {(Object.keys(COLUMN_META) as SessionKanbanColumnId[]).map(
                    (colId) => (
                      <DroppableColumn
                        key={colId}
                        id={colId}
                        className="flex h-[min(65vh,640px)] min-h-[280px] w-[min(88vw,19rem)] shrink-0 snap-center flex-col sm:w-[min(42vw,20rem)] 2xl:h-[min(70vh,720px)] 2xl:w-auto 2xl:min-w-0 2xl:max-w-none"
                      >
                        <div
                          className={cn(
                            "shrink-0 border-b border-border/60 px-3 py-2.5",
                            COLUMN_META[colId].headerBg,
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold tracking-tight text-foreground">
                                {COLUMN_META[colId].title}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {COLUMN_META[colId].description}
                              </p>
                            </div>
                            <span
                              className={cn(
                                "inline-flex min-w-7 items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                                COLUMN_META[colId].countClass,
                              )}
                            >
                              {columns[colId].length}
                            </span>
                          </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3">
                          <div className="flex min-h-full flex-col gap-2 pt-2">
                            <AnimatePresence initial={false}>
                              {columns[colId].length === 0 ? (
                                <motion.div
                                  key="empty"
                                  initial={
                                    reduceMotion ? false : { opacity: 0, y: 6 }
                                  }
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground"
                                >
                                  <ClipboardList className="size-6 opacity-40" />
                                  <p>{COLUMN_META[colId].emptyHint}</p>
                                </motion.div>
                              ) : (
                                columns[colId].map((c) => (
                                  <DraggableSessionCard
                                    key={c.id}
                                    claim={c}
                                    columnId={colId}
                                    now={now}
                                    onOpen={() => openWorkspace(c)}
                                    onQr={() => {
                                      setQrClaim(c);
                                      setQrOpen(true);
                                    }}
                                    onUpload={() => {
                                      setUploadClaim(c);
                                      setUploadOpen(true);
                                    }}
                                    onAttendance={async () => {
                                      setAttendanceClaim(c);
                                      setAttendanceOpen(true);
                                      try {
                                        await loadAttendanceForClaim(c.id);
                                      } catch (e) {
                                        toast.error(
                                          e instanceof Error
                                            ? e.message
                                            : "Could not load attendance",
                                        );
                                        setAttendanceRows([]);
                                      }
                                    }}
                                    onSubmit={() => {
                                      setSubmitClaim(c);
                                      setSubmitOpen(true);
                                    }}
                                    onWorkspace={() => openWorkspace(c)}
                                    onDiscard={() => openDiscard([c.id])}
                                    onEditRequest={
                                      c.request_status ===
                                      SESSION_REQUEST_STATUS.CHANGES_REQUESTED
                                        ? () => openResubmitRequest(c)
                                        : undefined
                                    }
                                    draftSelectMode={draftSelectMode}
                                    draftSelected={selectedDraftIds.has(c.id)}
                                    onToggleDraftSelect={() =>
                                      toggleDraftSelected(c.id)
                                    }
                                  />
                                ))
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </DroppableColumn>
                    ))}
                  </div>
                  <DragOverlay dropAnimation={null}>
                    {activeDrag ? (
                      <KanbanDragOverlay claim={activeDrag.claim} />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              )}
            </TabsContent>


            <TabsContent
              value="table"
              className="mt-0 flex min-h-0 flex-1 flex-col overflow-hidden data-[state=inactive]:hidden"
            >
              <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-border/70 shadow-sm">
                <CardContent className="flex min-h-0 flex-1 flex-col p-0">
                  <ScrollArea className="min-h-0 flex-1">
                    <div className="min-w-0 overflow-x-auto">
                      <Table className="min-w-[48rem] [&_[data-slot=table-container]]:overflow-visible">
                        <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm">
                          <TableRow className="border-b border-border/80 hover:bg-transparent">
                            {draftSelectMode ? (
                              <TableHead className="h-11 w-10 px-2">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-input accent-(--lagoon-deep)"
                                  checked={
                                    visibleDrafts.length > 0 &&
                                    visibleDrafts.every((c) =>
                                      selectedDraftIds.has(c.id),
                                    )
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedDraftIds(
                                        new Set(visibleDrafts.map((c) => c.id)),
                                      );
                                    } else {
                                      setSelectedDraftIds(new Set());
                                    }
                                  }}
                                  aria-label="Select all visible drafts"
                                />
                              </TableHead>
                            ) : null}
                            <TableHead className="h-11 w-[7.5rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Date
                            </TableHead>
                            <TableHead className="h-11 w-[6.5rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Time
                            </TableHead>
                            <TableHead className="h-11 min-w-[12rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Module
                            </TableHead>
                            <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Kind
                            </TableHead>
                            <TableHead className="h-11 min-w-[8rem] px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Venue
                            </TableHead>
                            <TableHead className="h-11 px-4 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Hours
                            </TableHead>
                            <TableHead className="h-11 px-4 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Evidence
                            </TableHead>
                            <TableHead className="h-11 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                              Status
                            </TableHead>
                            <TableHead className="h-11 w-12 px-2" />
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                              <TableRow key={i} className="hover:bg-transparent">
                                <TableCell
                                  colSpan={draftSelectMode ? 10 : 9}
                                  className="py-3"
                                >
                                  <Skeleton className="h-10 w-full rounded-md" />
                                </TableCell>
                              </TableRow>
                            ))
                          ) : tableSortedClaims.length === 0 ? (
                            <TableRow className="hover:bg-transparent">
                              <TableCell
                                colSpan={draftSelectMode ? 10 : 9}
                                className="h-40 p-0"
                              >
                                <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
                                  <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
                                    <ClipboardList
                                      className="size-6 text-muted-foreground"
                                      aria-hidden
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="font-medium text-foreground">
                                      No sessions match your filters
                                    </p>
                                    <p className="max-w-sm text-sm text-muted-foreground">
                                      Adjust search, module, date, or status
                                      filters to see sessions here.
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            tableSortedClaims.map((claim, index) => {
                              const status = claim.status as ClaimStatus;
                              return (
                                <TableRow
                                  key={claim.id}
                                  className={cn(
                                    "group cursor-pointer border-b border-border/40 border-l-[3px] transition-colors",
                                    claimStatusRail(status),
                                    index % 2 === 1 && "bg-muted/20",
                                    "hover:bg-lagoon/5 hover:border-l-lagoon-deep",
                                  )}
                                  onClick={() => {
                                    if (draftSelectMode && status === "DRAFT") {
                                      toggleDraftSelected(claim.id);
                                      return;
                                    }
                                    openWorkspace(claim);
                                  }}
                                >
                                  {draftSelectMode ? (
                                    <TableCell
                                      className="w-10 px-2 py-3.5 align-middle"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {status === "DRAFT" ? (
                                        <input
                                          type="checkbox"
                                          checked={selectedDraftIds.has(claim.id)}
                                          onChange={() =>
                                            toggleDraftSelected(claim.id)
                                          }
                                          className="size-4 rounded border-input accent-(--lagoon-deep)"
                                          aria-label={`Select ${claim.module?.code ?? "draft"} session`}
                                        />
                                      ) : null}
                                    </TableCell>
                                  ) : null}
                                  <TableCell className="px-4 py-3.5 align-top whitespace-normal">
                                    <p className="font-semibold tabular-nums text-foreground">
                                      {format(
                                        parseISO(claim.session_date),
                                        "MMM d, yyyy",
                                      )}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(
                                        parseISO(claim.session_date),
                                        "EEEE",
                                      )}
                                    </p>
                                  </TableCell>
                                  <TableCell className="px-4 py-3.5 align-top tabular-nums text-sm text-foreground">
                                    {formatClock(claim.start_time)}–
                                    {formatClock(claim.end_time)}
                                  </TableCell>
                                  <TableCell className="max-w-[14rem] px-4 py-3.5 align-top whitespace-normal">
                                    <div className="flex flex-col gap-1">
                                      {claim.module?.code ? (
                                        <span className="w-fit rounded-md bg-lagoon/10 px-2 py-0.5 text-xs font-semibold tracking-wide text-lagoon-deep">
                                          {claim.module.code}
                                        </span>
                                      ) : (
                                        <span className="text-sm text-muted-foreground">
                                          —
                                        </span>
                                      )}
                                      <span
                                        className="line-clamp-2 text-xs leading-snug text-muted-foreground"
                                        title={claim.module?.name ?? undefined}
                                      >
                                        {claim.module?.name ?? "Unknown module"}
                                      </span>
                                    </div>
                                  </TableCell>
                                  <TableCell className="px-4 py-3.5 align-top whitespace-normal">
                                    <Badge
                                      variant="secondary"
                                      className="font-normal capitalize"
                                    >
                                      {claim.session_kind || "Manual"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="max-w-[10rem] px-4 py-3.5 align-top text-sm text-muted-foreground">
                                    <span
                                      className="line-clamp-2"
                                      title={claim.venue ?? undefined}
                                    >
                                      {claim.venue ?? "—"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-4 py-3.5 text-right align-top">
                                    <span className="inline-flex min-w-11 justify-center rounded-md bg-muted/50 px-2 py-1 text-sm font-semibold tabular-nums text-foreground">
                                      {claim.hours.toFixed(1)}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-4 py-3.5 text-center align-top">
                                    {claim.evidenceCount > 0 ? (
                                      <Badge
                                        variant="success"
                                        className="mx-auto gap-1 px-2.5 py-0.5"
                                      >
                                        <CheckCircle2 className="size-3" />
                                        {claim.evidenceCount}
                                      </Badge>
                                    ) : (
                                      <span
                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                        title="No evidence attached"
                                      >
                                        <FileWarning className="size-3.5 opacity-60" />
                                        None
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="px-4 py-3.5 align-top">
                                    <Badge variant={claimBadgeVariant(status)}>
                                      {claimBadgeLabel(status)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="px-2 py-3.5 text-right align-middle">
                                    {status === "DRAFT" ? (
                                      <Button
                                        type="button"
                                        size="sm"
                                        className="gap-1.5"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSubmitClaim(claim);
                                          setSubmitOpen(true);
                                        }}
                                      >
                                        <Send className="size-3.5" />
                                        Submit claim
                                      </Button>
                                    ) : (
                                      <ChevronRight className="ml-auto size-4 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-lagoon-deep" />
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </ScrollArea>
                  {tableSortedClaims.length > 0 && !loading ? (
                    <div className="shrink-0 border-t border-border/60 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {tableSortedClaims.length}
                      </span>{" "}
                      session{tableSortedClaims.length === 1 ? "" : "s"} · newest
                      first
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Button
          type="button"
          size="lg"
          aria-label="Create session"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 h-12 gap-2 rounded-full px-4 shadow-lg sm:px-5"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5 shrink-0" />
          <span className="hidden sm:inline">Create session</span>
        </Button>

        <Dialog
            open={detailOpen}
            onOpenChange={(o) => {
              if (!o) closeDetailSearch();
            }}
          >
            <DialogContent className="max-h-[90vh] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Session workspace</DialogTitle>
                <DialogDescription>
                  {detailClaim?.module
                    ? `${detailClaim.module.code} — ${detailClaim.module.name}`
                    : "Session"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                {detailClaim ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Date</span>
                    <span className="text-foreground">
                      {format(
                        parseISO(`${detailClaim.session_date}T12:00:00`),
                        "d MMM yyyy",
                      )}
                    </span>
                    <span>Time</span>
                    <span className="text-foreground">
                      {formatClock(detailClaim.start_time)}–
                      {formatClock(detailClaim.end_time)}
                    </span>
                    <span>Venue</span>
                    <span className="text-foreground">
                      {detailClaim.venue ?? "—"}
                    </span>
                    <span>Hours</span>
                    <span className="text-foreground">{detailClaim.hours}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={claimBadgeVariant(detailClaim.status)}>
                      {claimBadgeLabel(detailClaim.status)}
                    </Badge>
                    {detailClaim.session_kind ? (
                      <Badge variant="outline">{detailClaim.session_kind}</Badge>
                    ) : null}
                  </div>
                  {detailClaim.topics_covered ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Topics covered
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
                        {detailClaim.topics_covered}
                      </p>
                    </div>
                  ) : null}
                  {detailClaim.notes ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
                        {detailClaim.notes}
                      </p>
                    </div>
                  ) : null}
                  <PrivateSessionFeedbackReadBlock
                    claimId={detailClaim.id}
                    claimStatus={detailClaim.status}
                  />
                </div>
              ) : null}
              </ScrollArea>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap gap-2">
                  {detailClaim?.status === "DRAFT" ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDiscard([detailClaim.id])}
                    >
                      <Trash2 className="size-4" />
                      Discard draft
                    </Button>
                  ) : null}
                  {detailClaim?.status === "DRAFT" ? (
                    <Button
                      type="button"
                      onClick={() => {
                        setSubmitClaim(detailClaim);
                        setSubmitOpen(true);
                      }}
                    >
                      <Send className="size-4" />
                      Submit claim
                    </Button>
                  ) : null}
                  <Button variant="outline" asChild>
                    <Link
                      to="/tutor/notes"
                      search={{
                        claim: detailClaim?.id,
                        focus: Date.now(),
                      }}
                    >
                      <StickyNote className="size-4" />
                      Open notes
                    </Link>
                  </Button>
                </div>
                <Button onClick={closeDetailSearch}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Session QR</DialogTitle>
                <DialogDescription>
                  Scan to return tutors straight to this session workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2">
                {qrClaim ? (
                  <>
                    <div className="rounded-lg border bg-white p-3">
                      <QRCodeSVG value={sessionQrValue} size={180} level="M" />
                    </div>
                    <p className="break-all text-center text-xs text-muted-foreground">
                      {sessionQrValue}
                    </p>
                  </>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload register</DialogTitle>
                <DialogDescription>
                  Attach a class register or attendance sheet (max 12MB).
                </DialogDescription>
              </DialogHeader>
              {uploadClaim ? (
                <form
                  className="space-y-3"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    const fd = new FormData(ev.currentTarget);
                    const file = fd.get("file");
                    if (!(file instanceof File) || file.size === 0) {
                      toast.error("Choose a file first.");
                      return;
                    }
                    setUploadBusy(true);
                    try {
                      const b64 = await fileToBase64(file);
                      await registerAttendanceEvidenceFn({
                        data: {
                          claimId: uploadClaim.id,
                          fileBase64: b64,
                          fileName: file.name,
                          mimeType: file.type || "application/octet-stream",
                        },
                      });
                      toast.success("Register uploaded");
                      setUploadOpen(false);
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Upload failed",
                      );
                    } finally {
                      setUploadBusy(false);
                    }
                  }}
                >
                  <Input name="file" type="file" required />
                  <DialogFooter>
                    <Button type="submit" disabled={uploadBusy}>
                      {uploadBusy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog
            open={attendanceOpen}
            onOpenChange={(open) => {
              setAttendanceOpen(open);
              if (!open) {
                setAttendanceClaim(null);
                setAttendanceRows(null);
              }
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Record attendance</DialogTitle>
                <DialogDescription>
                  {attendanceClaim?.module
                    ? `${attendanceClaim.module.code} — scan student cards to mark who was present.`
                    : "Scan student cards to mark who was present."}
                </DialogDescription>
              </DialogHeader>
              {attendanceClaim ? (
                <StudentCardScanner
                  enabled={attendanceScanEnabled}
                  busy={attendanceScanning}
                  onScan={handleAttendanceScan}
                />
              ) : null}
              {!attendanceScanEnabled && attendanceClaim ? (
                <p className="text-xs text-amber-700 dark:text-amber-200">
                  Scanning is closed for this session (locked or outside the
                  session window).
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Present ({attendanceRows?.length ?? 0})
                </p>
                <ScrollArea className="max-h-48 pr-4">
                  <div className="space-y-2 text-sm">
                    {attendanceRows?.length ? (
                      attendanceRows.map((r) => (
                        <div
                          key={r.id}
                          className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {r.student.full_name}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {r.student.student_reference ??
                                r.student.email ??
                                "—"}
                              {r.check_in_time
                                ? ` · ${format(parseISO(r.check_in_time), "HH:mm")}`
                                : ""}
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-[10px]"
                          >
                            {r.status}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">
                        No students recorded yet. Scan a card to mark someone
                        present.
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </DialogContent>
          </Dialog>

          <SubmitClaimDialog
            claim={submitClaim}
            open={submitOpen}
            onOpenChange={setSubmitOpen}
            onSubmitted={reload}
          />

          <Dialog
            open={discardOpen}
            onOpenChange={(open) => {
              setDiscardOpen(open);
              if (!open) setDiscardTargetIds([]);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {discardTargetIds.length > 1
                    ? `Discard ${discardTargetIds.length} drafts?`
                    : "Discard draft?"}
                </DialogTitle>
                <DialogDescription>
                  {discardTargetIds.length > 1
                    ? "These sessions will be removed from your workspace and claims list. This cannot be undone."
                    : "This removes the session from your workspace and claims list. It cannot be undone."}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setDiscardOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={discardBusy || discardTargetIds.length === 0}
                  onClick={async () => {
                    if (discardTargetIds.length === 0) return;
                    setDiscardBusy(true);
                    try {
                      if (discardTargetIds.length === 1) {
                        await deleteDraftSessionClaimFn({
                          data: { claimId: discardTargetIds[0]! },
                        });
                        toast.success("Draft discarded");
                      } else {
                        const result = await deleteDraftSessionClaimsFn({
                          data: { claimIds: discardTargetIds },
                        });
                        toast.success(
                          `${result.deletedCount} drafts discarded`,
                        );
                      }
                      setDiscardOpen(false);
                      exitDraftSelectMode();
                      if (
                        detailClaim &&
                        discardTargetIds.includes(detailClaim.id)
                      ) {
                        closeDetailSearch();
                      }
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Could not discard",
                      );
                    } finally {
                      setDiscardBusy(false);
                    }
                  }}
                >
                  {discardBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Discard
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog
            open={createOpen}
            onOpenChange={(open) => {
              setCreateOpen(open);
              if (!open) setResubmitClaimId(null);
            }}
          >
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>
                  {resubmitClaimId ? "Update session request" : "Request session"}
                </DialogTitle>
                <DialogDescription>
                  Your lecturer and admin will review this request. After approval
                  it is added to the schedule and you can submit attendance for
                  verification.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-1">
                <div className="grid gap-1.5">
                  <Label>Module</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                    value={createModuleId}
                    onChange={(e) => setCreateModuleId(e.target.value)}
                  >
                    {modules.map((m) => (
                      <option key={m.moduleId} value={m.moduleId}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Session type</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                    value={createSessionKind}
                    onChange={(e) => setCreateSessionKind(e.target.value)}
                  >
                    <option value="tutorial">Tutorial</option>
                    <option value="workshop">Workshop</option>
                    <option value="one_off">One-off</option>
                    <option value="consultation">Consultation</option>
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Calendar
                    mode="single"
                    selected={createDate}
                    onSelect={(d) => d && setCreateDate(d)}
                    className="rounded-md border p-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Start</Label>
                    <Input
                      value={createStart}
                      onChange={(e) => setCreateStart(e.target.value)}
                      placeholder="09:00"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End</Label>
                    <Input
                      value={createEnd}
                      onChange={(e) => setCreateEnd(e.target.value)}
                      placeholder="10:00"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Duration:{" "}
                  {(() => {
                    const [sh, sm] = createStart.split(":").map(Number);
                    const [eh, em] = createEnd.split(":").map(Number);
                    let mins = (eh * 60 + em) - (sh * 60 + sm);
                    if (mins <= 0) mins += 24 * 60;
                    const h = Math.round((mins / 60) * 10) / 10;
                    return `${h}h`;
                  })()}
                </p>
                <div className="grid gap-1.5">
                  <Label>Venue</Label>
                  <Input
                    value={createVenue}
                    onChange={(e) => setCreateVenue(e.target.value)}
                    placeholder="Room or link"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Reason</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm dark:bg-input/30"
                    value={createRequestReason}
                    onChange={(e) => setCreateRequestReason(e.target.value)}
                    placeholder="Why is this session needed? (min 10 characters)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={
                    createBusy ||
                    !createModuleId ||
                    createRequestReason.trim().length < 10
                  }
                  onClick={async () => {
                    setCreateBusy(true);
                    try {
                      const payload = {
                        moduleId: createModuleId,
                        sessionDate: format(createDate, "yyyy-MM-dd"),
                        startTime: createStart,
                        endTime: createEnd,
                        venue: createVenue || undefined,
                        sessionKind: createSessionKind,
                        requestReason: createRequestReason.trim(),
                      };
                      if (resubmitClaimId) {
                        await resubmitSessionRequestFn({
                          data: { claimId: resubmitClaimId, ...payload },
                        });
                        toast.success("Session request updated");
                      } else {
                        const result = await createSessionClaimFn({
                          data: payload,
                        });
                        if (result.budgetWarning) {
                          toast.warning(result.budgetWarning);
                        }
                        toast.success(
                          "Session request sent — awaiting admin approval",
                        );
                      }
                      setCreateOpen(false);
                      setResubmitClaimId(null);
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Could not save request",
                      );
                    } finally {
                      setCreateBusy(false);
                    }
                  }}
                >
                  {createBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  {resubmitClaimId ? "Resubmit request" : "Send request"}
                </Button>
              </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
