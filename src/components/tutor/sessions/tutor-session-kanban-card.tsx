import { useDraggable, useDroppable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  GripVertical,
  MapPin,
  MoreHorizontal,
  QrCode,
  Send,
  StickyNote,
  Trash2,
  Upload,
  UserCheck,
} from "lucide-react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import {
  COLUMN_META,
  DROP_PREFIX,
} from "#/components/tutor/sessions/tutor-sessions-board-meta";
import {
  isTutorManualRequestInPendingColumn,
  sessionRequestStatusLabel,
} from "#/lib/session-request-status";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";
import { cn } from "#/lib/utils";

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

export function KanbanDragOverlay({ claim }: { claim: TutorSessionClaimDTO }) {
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
          {format(parseISO(`${claim.session_date}T12:00:00`), "EEE d MMM")} ·{" "}
          {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function DroppableColumn({
  id,
  children,
  className,
}: {
  id: SessionKanbanColumnId;
  children: React.ReactNode;
  className?: string;
}) {
  const meta = COLUMN_META[id];
  const { setNodeRef, isOver } = useDroppable({
    id: `${DROP_PREFIX}${id}`,
    disabled: id === "claimsPending",
    data: { columnId: id },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-border/80 bg-card shadow-sm transition-all duration-200",
        meta.accentBorder,
        "border-t-[3px]",
        isOver &&
          id !== "claimsPending" &&
          "border-lagoon-deep/50 bg-lagoon/[0.04] ring-2 ring-lagoon-deep/15",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function KanbanColumnHeader({
  colId,
  count,
}: {
  colId: SessionKanbanColumnId;
  count: number;
}) {
  const meta = COLUMN_META[colId];
  const HeaderIcon = meta.headerIcon;
  return (
    <div
      className={cn(
        "shrink-0 border-b border-border/60 px-3 py-3",
        meta.headerBg,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg bg-background/90 shadow-sm",
              meta.iconClass,
            )}
          >
            <HeaderIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {meta.title}
            </p>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {meta.description}
            </p>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex min-w-7 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums",
            meta.countClass,
          )}
        >
          {count}
        </span>
      </div>
    </div>
  );
}

type DraggableSessionCardProps = {
  claim: TutorSessionClaimDTO;
  columnId: SessionKanbanColumnId;
  now: Date;
  onOpen: () => void;
  onQr: () => void;
  onUpload: () => void;
  onAttendance: () => void;
  onSubmit: () => void;
  onWorkspace: () => void;
  onDiscard?: () => void;
  onEditRequest?: () => void;
  draftSelectMode: boolean;
  draftSelected: boolean;
  onToggleDraftSelect: () => void;
  isSessionLive: (claim: TutorSessionClaimDTO, now: Date) => boolean;
  isSessionUrgent: (claim: TutorSessionClaimDTO, now: Date) => boolean;
};

export function DraggableSessionCard({
  claim,
  columnId,
  now,
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
  isSessionLive,
  isSessionUrgent,
}: DraggableSessionCardProps) {
  const reduceMotion = useReducedMotion();
  const isDraft = claim.status === "DRAFT";
  const pendingRequest = isTutorManualRequestInPendingColumn(claim);
  const canWorkSession = !pendingRequest;
  const dragDisabled =
    columnId === "claimsPending" || draftSelectMode || pendingRequest;
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: claim.id,
      disabled: dragDisabled,
      data: { columnId },
    });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const mod = claim.module;
  const status = claim.status as ClaimStatus;
  const live = !pendingRequest && isSessionLive(claim, now);
  const urgent = !pendingRequest && isSessionUrgent(claim, now);

  const expected = claim.attendance_expected_count;
  const present = claim.attendance_present_count;
  const hasHeadcount =
    expected != null && expected > 0 && present != null && present >= 0;
  const progressRatio = hasHeadcount
    ? Math.min(1, (present as number) / (expected as number))
    : claim.evidenceCount > 0
      ? 1
      : 0;
  const progressPct = Math.round(progressRatio * 100);

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
          "group/card overflow-hidden border border-border/70 bg-card shadow-sm transition-all hover:border-border hover:shadow-md",
          !pendingRequest && "border-l-[3px]",
          !pendingRequest && claimStatusRail(status),
          pendingRequest && "border-amber-500/30 bg-amber-500/[0.03]",
          live && "ring-1 ring-emerald-500/30",
          urgent && !live && "ring-1 ring-amber-500/25",
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
        {pendingRequest ? (
          <div className="border-b border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-950 dark:text-amber-100">
            {sessionRequestStatusLabel(
              claim.request_status as
                | "PENDING"
                | "CHANGES_REQUESTED"
                | "REJECTED"
                | "APPROVED"
                | null,
            )}
            {claim.review_feedback ? (
              <span className="mt-0.5 block font-normal text-amber-900/80 dark:text-amber-100/80">
                {claim.review_feedback}
              </span>
            ) : null}
          </div>
        ) : null}

        <CardHeader className="gap-3 p-3 pb-2">
          <div className="flex items-start gap-2">
            {draftSelectMode && isDraft ? (
              <label
                className="mt-1 flex shrink-0 cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={draftSelected}
                  onChange={onToggleDraftSelect}
                  className="size-4 rounded border-input accent-(--lagoon-deep)"
                  aria-label={`Select ${mod?.code ?? "session"} draft`}
                />
              </label>
            ) : null}
            {!dragDisabled ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 cursor-grab touch-none rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
                aria-label="Drag to reschedule"
                onClick={(e) => e.stopPropagation()}
                {...listeners}
                {...attributes}
              >
                <GripVertical className="size-4" />
              </button>
            ) : (
              <span className="mt-0.5 inline-flex shrink-0 p-1 text-muted-foreground/25">
                <GripVertical className="size-4" />
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {live ? (
                  <Badge variant="success" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <CircleDot className="size-3" />
                    Live now
                  </Badge>
                ) : urgent ? (
                  <Badge variant="warning" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <AlertTriangle className="size-3" />
                    Starting soon
                  </Badge>
                ) : null}
                {mod?.code ? (
                  <span className="rounded bg-lagoon/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-lagoon-deep uppercase">
                    {mod.code}
                  </span>
                ) : null}
              </div>

              <p className="mt-1.5 text-lg font-semibold tabular-nums tracking-tight text-foreground">
                {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(`${claim.session_date}T12:00:00`), "EEEE, d MMMM")}
              </p>

              <CardTitle className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-foreground">
                {mod?.name ?? "Unknown module"}
              </CardTitle>

              {claim.venue ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3 shrink-0" />
                  <span className="truncate">{claim.venue}</span>
                </p>
              ) : null}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onWorkspace}>Open session</DropdownMenuItem>
                {onEditRequest ? (
                  <DropdownMenuItem onSelect={onEditRequest}>
                    Update request
                  </DropdownMenuItem>
                ) : null}
                {canWorkSession ? (
                  <>
                    <DropdownMenuItem onSelect={onAttendance}>
                      Attendance roster
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onUpload}>
                      Upload register
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={onQr}>Session QR</DropdownMenuItem>
                  </>
                ) : null}
                {isDraft && canWorkSession ? (
                  <DropdownMenuItem onSelect={onSubmit}>Submit claim</DropdownMenuItem>
                ) : null}
                {isDraft && onDiscard ? (
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
                    Session notes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/tutor/messaging"
                    search={
                      mod?.lecturer_id ? { lecturer: mod.lecturer_id } : undefined
                    }
                  >
                    Message lecturer
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <div className="space-y-3 border-t border-border/50 px-3 py-3">
          {canWorkSession ? (
            <>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Attendance</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {hasHeadcount
                      ? `${present}/${expected}`
                      : claim.evidenceCount > 0
                        ? "Register uploaded"
                        : "Not started"}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-muted">
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

              <div
                className="flex flex-wrap gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  className="h-7 flex-1 gap-1 px-2 text-[11px]"
                  onClick={onAttendance}
                >
                  <UserCheck className="size-3.5" />
                  Attendance
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 flex-1 gap-1 px-2 text-[11px]"
                  onClick={onUpload}
                >
                  <Upload className="size-3.5" />
                  Register
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  className="h-7 gap-1 px-2 text-[11px]"
                  onClick={onQr}
                >
                  <QrCode className="size-3.5" />
                  QR
                </Button>
              </div>
            </>
          ) : onEditRequest ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation();
                onEditRequest();
              }}
            >
              Update request
            </Button>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-6 border border-border/60">
                <AvatarFallback className="text-[9px]">
                  {(mod?.lecturer?.full_name ?? "L")
                    .split(/\s+/)
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-[11px] text-muted-foreground">
                  {mod?.lecturer?.full_name ?? "Lecturer"}
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <Badge
                    variant={claimBadgeVariant(status)}
                    className="px-1 py-0 text-[9px]"
                  >
                    {claimBadgeLabel(status)}
                  </Badge>
                  {claim.evidenceCount > 0 ? (
                    <CheckCircle2 className="size-3 text-emerald-600" aria-hidden />
                  ) : null}
                  {(claim.notes?.trim() || claim.topics_covered?.trim()) && (
                    <StickyNote className="size-3 text-lagoon-deep" aria-hidden />
                  )}
                </div>
              </div>
            </div>
            {isDraft && canWorkSession ? (
              <Button
                type="button"
                size="xs"
                className="shrink-0 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmit();
                }}
              >
                <Send className="size-3.5" />
                Submit
              </Button>
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 group-hover/card:text-lagoon-deep" />
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export { AnimatePresence, motion };
