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
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MapPin,
  CheckSquare,
  ChevronRight,
  ClipboardList,
  FileWarning,
  Loader2,
  Plus,
  Send,
  StickyNote,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Calendar } from "#/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Tabs, TabsContent } from "#/components/ui/tabs";
import { TooltipProvider } from "#/components/ui/tooltip";
import { StudentCardScanner } from "#/components/tutor/attendance/student-card-scanner";
import { PrivateSessionFeedbackReadBlock } from "#/components/private-session-feedback/private-session-feedback-read-block";
import { SubmitClaimDialog } from "#/components/tutor/sessions/submit-claim-dialog";
import {
  DROP_PREFIX,
  COLUMN_META,
} from "#/components/tutor/sessions/tutor-sessions-board-meta";
import {
  DroppableColumn,
  DraggableSessionCard,
  KanbanColumnHeader,
  KanbanDragOverlay,
  AnimatePresence,
  motion,
} from "#/components/tutor/sessions/tutor-session-kanban-card";
import {
  TutorSessionsPageHeader,
  TutorSessionsToolbar,
} from "#/components/tutor/sessions/tutor-sessions-page-chrome";
import {
  attendanceScanWindowLabel,
  canTutorScanAttendanceForClaim,
} from "#/lib/session-attendance-open";
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
  isTutorManualRequestInPendingColumn,
  SESSION_REQUEST_STATUS,
} from "#/lib/session-request-status";
import { subscribeToTutorSessionClaims } from "#/lib/tutor-sessions-realtime";
import { useSessionUser } from "#/lib/use-session-user";
import {
  createSessionClaimFn,
  deleteDraftSessionClaimFn,
  deleteDraftSessionClaimsFn,
  getAttendanceDataFn,
  getClaimDetailsFn,
  listTutorModuleAssignmentsFn,
  listTutorSessionClaimsFn,
  registerAttendanceEvidenceFn,
  scanStudentForSessionFn,
  resubmitSessionRequestFn,
  updateSessionClaimSchedulingFn,
  type AttendanceRecordDTO,
  type ClaimDetailsDTO,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

function workspaceClaimFromDetails(detail: ClaimDetailsDTO): TutorSessionClaimDTO {
  return {
    id: detail.id,
    module_id: detail.module_id,
    session_date: detail.session_date,
    start_time: detail.start_time,
    end_time: detail.end_time,
    hours: detail.hours,
    venue: detail.venue,
    status: detail.status,
    notes: detail.notes,
    topics_covered: detail.topics_covered,
    coverage_validated_at: detail.coverage_validated_at,
    submitted_at: detail.submitted_at,
    session_kind: detail.session_kind,
    request_status: detail.request_status,
    request_reason: detail.request_reason,
    review_feedback: detail.review_feedback,
    attendance_present_count: detail.attendance_present_count,
    attendance_expected_count: detail.attendance_expected_count,
    attendance_locked_at: detail.attendance_locked_at,
    qr_token: detail.qr_token,
    qr_expires_at: detail.qr_expires_at,
    module: detail.module,
    evidenceCount: detail.evidence.length,
  };
}

const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
];

function claimTimes(claim: TutorSessionClaimDTO) {
  return {
    start: claim.start_time ?? "09:00",
    end: claim.end_time ?? "10:00",
  };
}

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
  const { user } = useSessionUser();
  const tutorId = user?.id ?? null;
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [resumeWorkspaceAfterDiscardCancel, setResumeWorkspaceAfterDiscardCancel] =
    useState(false);
  /** Prevents search.claim effect from reopening workspace right after discard. */
  const recentlyDiscardedClaimIds = useRef<Set<string>>(new Set());
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


  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const rows = await listTutorSessionClaimsFn();
      setClaims(rows);
    } catch (e) {
      if (!options?.silent) {
        toast.error(
          e instanceof Error ? e.message : "Could not load teaching sessions",
        );
        setClaims([]);
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, []);

  const scheduleSilentReload = useCallback(() => {
    if (reloadDebounceRef.current) {
      clearTimeout(reloadDebounceRef.current);
    }
    reloadDebounceRef.current = setTimeout(() => {
      void reload({ silent: true });
    }, 400);
  }, [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!tutorId) return;

    const unsubRealtime = subscribeToTutorSessionClaims(tutorId, scheduleSilentReload);
    const poll = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleSilentReload();
    }, 20_000);

    return () => {
      unsubRealtime();
      window.clearInterval(poll);
      if (reloadDebounceRef.current) clearTimeout(reloadDebounceRef.current);
    };
  }, [tutorId, scheduleSilentReload]);

  useEffect(() => {
    void getTutorHourBudgetFn()
      .then(setHourBudget)
      .catch(() => setHourBudget(null));
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [reload]);

  useEffect(() => {
    if (!detailClaim) return;
    const hit = claims.find((c) => c.id === detailClaim.id);
    if (hit) setDetailClaim(hit);
  }, [claims, detailClaim?.id]);

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
    const draftIds = new Set(
      claims.filter((claim) => claim.status === "DRAFT").map((claim) => claim.id),
    );
    const safeIds = claimIds.filter((id) => draftIds.has(id));
    if (safeIds.length === 0) return;

    const returnToWorkspace =
      detailOpen &&
      safeIds.length === 1 &&
      detailClaim?.id === safeIds[0];
    setResumeWorkspaceAfterDiscardCancel(returnToWorkspace);
    setDetailOpen(false);
    setDiscardTargetIds(safeIds);
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
    if (!search.claim) {
      recentlyDiscardedClaimIds.current.clear();
      return;
    }

    if (recentlyDiscardedClaimIds.current.has(search.claim)) {
      return;
    }

    const hit = claims.find((c) => c.id === search.claim);
    if (hit) {
      setDetailClaim(hit);
      setDetailOpen(true);
      return;
    }

    if (loading) return;

    setDetailClaim(null);
    setDetailOpen(false);

    let cancelled = false;
    void (async () => {
      try {
        const detail = await getClaimDetailsFn({
          data: { claimId: search.claim! },
        });
        if (cancelled) return;
        if (recentlyDiscardedClaimIds.current.has(search.claim!)) return;
        setDetailClaim(workspaceClaimFromDetails(detail));
        setDetailOpen(true);
      } catch {
        if (!cancelled && search.claim) {
          recentlyDiscardedClaimIds.current.add(search.claim);
          // If the claim cannot be loaded (e.g. deleted or inaccessible),
          // leave the URL alone and just keep the workspace closed instead
          // of navigating away and clearing the `claim` parameter.
          setDetailClaim(null);
          setDetailOpen(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [search.claim, claims, loading, navigate]);

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
      if (isTutorManualRequestInPendingColumn(c)) {
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
    setDetailClaim(null);
    setDetailOpen(false);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: undefined },
      replace: true,
    });
  };

  const finishDiscardSuccess = (discardedIds: string[]) => {
    for (const id of discardedIds) {
      recentlyDiscardedClaimIds.current.add(id);
    }
    setResumeWorkspaceAfterDiscardCancel(false);
    setDiscardTargetIds([]);
    setDiscardOpen(false);
    setDetailClaim(null);
    setDetailOpen(false);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: undefined },
      replace: true,
    });
  };

  const discardConfirmClaim =
    discardTargetIds.length === 1
      ? claims.find((c) => c.id === discardTargetIds[0]) ??
        (detailClaim?.id === discardTargetIds[0] ? detailClaim : null)
      : null;

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
        <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6 lg:p-8">
          <TutorSessionsPageHeader
            onCreateSession={() => setCreateOpen(true)}
            loading={loading}
            hourBudget={hourBudget}
            stats={stats}
            columnCounts={{
              claimsPending: columns.claimsPending.length,
              today: columns.today.length,
              upcoming: columns.upcoming.length,
              completed: columns.completed.length,
            }}
          />

          <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
            <TutorSessionsToolbar
              embedded
              searchText={searchText}
              onSearchChange={setSearchText}
              moduleFilter={moduleFilter}
              onModuleFilter={setModuleFilter}
              moduleOptions={moduleOptions}
              dateFilter={dateFilter}
              onDateFilter={setDateFilter}
              datePickOpen={datePickOpen}
              onDatePickOpen={setDatePickOpen}
              datePickTemp={datePickTemp}
              onDatePickTemp={setDatePickTemp}
              statusFilters={statusFilters}
              onToggleStatus={toggleStatus}
              workspaceTab={workspaceTab}
              onWorkspaceTabChange={onWorkspaceTabChange}
              onClearFilters={() => {
                setModuleFilter("all");
                setDateFilter(undefined);
                setStatusFilters(new Set(ALL_STATUSES));
              }}
              draftSelectSlot={
                visibleDrafts.length > 0 ? (
                  <Button
                    type="button"
                    variant={draftSelectMode ? "secondary" : "outline"}
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => {
                      if (draftSelectMode) exitDraftSelectMode();
                      else setDraftSelectMode(true);
                    }}
                  >
                    <CheckSquare className="size-4" />
                    {draftSelectMode ? "Cancel" : "Select drafts"}
                  </Button>
                ) : null
              }
            />

            {draftSelectMode && visibleDrafts.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-lagoon/5 px-3 py-2 text-sm sm:px-4">
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

            <div className="border-t border-border/60">
          <Tabs
            value={workspaceTab}
            onValueChange={onWorkspaceTabChange}
            className="flex flex-col"
          >
            <TabsContent
              value="kanban"
              className="mt-0 flex flex-col p-3 data-[state=inactive]:hidden sm:p-4"
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
                        <KanbanColumnHeader
                          colId={colId}
                          count={columns[colId].length}
                        />
                        <ScrollArea className="min-h-0 flex-1">
                          <div className="flex min-h-full flex-col gap-2 px-2 pb-3 pt-2">
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
                                    isSessionLive={isSessionLive}
                                    isSessionUrgent={isSessionUrgent}
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
                                    onDiscard={
                                      c.status === "DRAFT"
                                        ? () => openDiscard([c.id])
                                        : undefined
                                    }
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
                        </ScrollArea>
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
              className="mt-0 flex flex-col data-[state=inactive]:hidden"
            >
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
                  {tableSortedClaims.length > 0 && !loading ? (
                    <div className="shrink-0 border-t border-border/60 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
                      Showing{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {tableSortedClaims.length}
                      </span>{" "}
                      session{tableSortedClaims.length === 1 ? "" : "s"} · newest
                      first
                    </div>
                  ) : null}
            </TabsContent>
          </Tabs>
            </div>
          </div>
        </div>
        </ScrollArea>

        <Button
          type="button"
          size="lg"
          aria-label="Request session"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 inline-flex h-12 gap-2 rounded-full bg-(--lagoon-deep) px-4 text-white shadow-lg hover:bg-(--lagoon-deep)/90 sm:hidden"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-5 shrink-0" />
          Request
        </Button>

        <Dialog
            open={detailOpen}
            onOpenChange={(o) => {
              if (!o) closeDetailSearch();
            }}
          >
            <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
              <DialogHeader className="space-y-3 border-b border-border/60 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2">
                  {detailClaim?.module?.code ? (
                    <span className="rounded-md bg-lagoon/15 px-2 py-0.5 text-xs font-semibold tracking-wide text-lagoon-deep">
                      {detailClaim.module.code}
                    </span>
                  ) : null}
                  {detailClaim ? (
                    <>
                      <Badge variant={claimBadgeVariant(detailClaim.status)}>
                        {claimBadgeLabel(detailClaim.status)}
                      </Badge>
                      {detailClaim.session_kind ? (
                        <Badge variant="outline" className="font-normal capitalize">
                          {detailClaim.session_kind}
                        </Badge>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="space-y-1 text-left">
                  <DialogTitle className="font-display text-xl leading-tight">
                    Session workspace
                  </DialogTitle>
                  <DialogDescription className="text-sm leading-snug">
                    {detailClaim?.module?.name ?? "Teaching session"}
                  </DialogDescription>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[min(52vh,28rem)] flex-1 px-6 py-4">
                {detailClaim ? (
                  <div className="space-y-4 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                          Date
                        </p>
                        <p className="mt-1 font-medium tabular-nums text-foreground">
                          {format(
                            parseISO(`${detailClaim.session_date}T12:00:00`),
                            "d MMM yyyy",
                          )}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Clock className="size-3.5 shrink-0" aria-hidden />
                          Time
                        </p>
                        <p className="mt-1 font-medium tabular-nums text-foreground">
                          {formatClock(detailClaim.start_time)}–
                          {formatClock(detailClaim.end_time)}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          Venue
                        </p>
                        <p className="mt-1 font-medium text-foreground">
                          {detailClaim.venue ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Video className="size-3.5 shrink-0" aria-hidden />
                          Hours
                        </p>
                        <p className="mt-1 font-medium tabular-nums text-foreground">
                          {detailClaim.hours.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    {detailClaim.topics_covered ? (
                      <div className="rounded-lg border border-border/70 bg-card p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Topics covered
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                          {detailClaim.topics_covered}
                        </p>
                      </div>
                    ) : null}
                    {detailClaim.notes ? (
                      <div className="rounded-lg border border-border/70 bg-card p-3">
                        <p className="text-xs font-semibold text-muted-foreground">
                          Session notes
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
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

              <DialogFooter className="flex-col gap-3 border-t border-border/60 bg-muted/10 px-6 py-4 sm:flex-col">
                {detailClaim?.status === "DRAFT" ? (
                  <Button
                    type="button"
                    className="w-full gap-2 bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)/90"
                    onClick={() => {
                      setSubmitClaim(detailClaim);
                      setSubmitOpen(true);
                    }}
                  >
                    <Send className="size-4" />
                    Submit claim
                  </Button>
                ) : null}
                <div className="flex w-full flex-wrap items-center gap-2">
                  <Button variant="outline" className="gap-2" asChild>
                    <Link
                      to="/tutor/notes"
                      search={{
                        claim: detailClaim?.id,
                        focus: Date.now(),
                      }}
                    >
                      <StickyNote className="size-4 text-(--lagoon-deep)" />
                      Open notes
                    </Link>
                  </Button>
                  {detailClaim?.status === "DRAFT" ? (
                    <Button
                      type="button"
                      variant="ghost"
                      className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => openDiscard([detailClaim.id])}
                    >
                      <Trash2 className="size-4" />
                      Discard draft
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto"
                    onClick={closeDetailSearch}
                  >
                    Close
                  </Button>
                </div>
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
                  {attendanceScanWindowLabel({
                    attendance_locked_at: attendanceClaim.attendance_locked_at,
                    session_date: attendanceClaim.session_date,
                    start_time: attendanceClaim.start_time,
                    end_time: attendanceClaim.end_time,
                  }) ?? "Scanning is closed for this session."}
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
              if (!open) {
                setDiscardTargetIds([]);
                if (
                  resumeWorkspaceAfterDiscardCancel &&
                  detailClaim &&
                  !recentlyDiscardedClaimIds.current.has(detailClaim.id)
                ) {
                  setDetailOpen(true);
                }
                setResumeWorkspaceAfterDiscardCancel(false);
              }
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
                  {discardTargetIds.length > 1 ? (
                    "These sessions will be removed from your workspace and claims list. This cannot be undone."
                  ) : discardConfirmClaim ? (
                    <>
                      Confirm you want to discard the draft for{" "}
                      <span className="font-medium text-foreground">
                        {discardConfirmClaim.module?.code ?? "this module"}
                      </span>{" "}
                      on{" "}
                      <span className="font-medium text-foreground">
                        {format(
                          parseISO(
                            `${discardConfirmClaim.session_date}T12:00:00`,
                          ),
                          "d MMM yyyy",
                        )}
                      </span>
                      . It will be removed from your workspace and claims list
                      and cannot be undone.
                    </>
                  ) : (
                    "This removes the session from your workspace and claims list. It cannot be undone."
                  )}
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
                      const discardedIds = [...discardTargetIds];
                      finishDiscardSuccess(discardedIds);
                      exitDraftSelectMode();
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
                      await reload({ silent: true });
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
