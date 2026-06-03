import { useEffect, useMemo, useRef, useState } from "react";
import { APP_PATHS } from "#/lib/app-paths";
import {
  getClaimDetailsFn,
  type TutorSessionClaimDTO,
  updateSessionClaimSchedulingFn,
} from "#/server-actions/tutor-sessions";
import {
  COLUMN_META,
  resolveKanbanDropColumn,
} from "./tutor-sessions-board-meta";
import { workspaceClaimFromDetails } from "./tutor-sessions-workspace-helpers";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";
import type { useTutorSessionsWorkspaceData } from "./use-tutor-sessions-workspace-data";
import { toast } from "#/lib/toast";

export type SessionsSearch = { claim?: string };

export function useTutorSessionsWorkspaceState({
  search,
  data,
  navigate,
}: {
  search: SessionsSearch;
  data: ReturnType<typeof useTutorSessionsWorkspaceData>;
  navigate: (opts: {
    to: string;
    search?: Record<string, unknown>;
    replace?: boolean;
  }) => void | Promise<void>;
}) {
  const recentlyDiscardedClaimIds = useRef<Set<string>>(new Set());

  const [workspaceTab, setWorkspaceTab] = useState<"kanban" | "table">("kanban");
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailClaim, setDetailClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrClaim, setQrClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadClaim, setUploadClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceClaim, setAttendanceClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitClaim, setSubmitClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [resubmitClaim, setResubmitClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardTargetIds, setDiscardTargetIds] = useState<string[]>([]);
  const [resumeWorkspaceAfterDiscardCancel, setResumeWorkspaceAfterDiscardCancel] =
    useState(false);
  const [draftSelectMode, setDraftSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeDrag, setActiveDrag] = useState<
    | {
        claim: TutorSessionClaimDTO;
        columnId: SessionKanbanColumnId;
      }
    | null
  >(null);

  useEffect(() => {
    if (!detailClaim) return;
    const hit = data.claims.find((c) => c.id === detailClaim.id);
    if (hit) setDetailClaim(hit);
  }, [data.claims, detailClaim?.id]);

  useEffect(() => {
    const draftIds = new Set(
      data.claims.filter((c) => c.status === "DRAFT").map((c) => c.id),
    );
    setSelectedDraftIds((prev) => {
      const next = new Set([...prev].filter((id) => draftIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [data.claims]);

  useEffect(() => {
    if (!search.claim) {
      recentlyDiscardedClaimIds.current.clear();
      return;
    }
    if (recentlyDiscardedClaimIds.current.has(search.claim)) return;

    const hit = data.claims.find((c) => c.id === search.claim);
    if (hit) {
      setDetailClaim(hit);
      setDetailOpen(true);
      return;
    }
    if (data.loading) return;

    setDetailClaim(null);
    setDetailOpen(false);

    let cancelled = false;
    void (async () => {
      try {
        const detail = await getClaimDetailsFn({ data: { claimId: search.claim! } });
        if (cancelled) return;
        if (recentlyDiscardedClaimIds.current.has(search.claim!)) return;
        setDetailClaim(workspaceClaimFromDetails(detail));
        setDetailOpen(true);
      } catch {
        if (!cancelled && search.claim) {
          recentlyDiscardedClaimIds.current.add(search.claim);
          setDetailClaim(null);
          setDetailOpen(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.claim, data.claims, data.loading]);

  const closeDetailSearch = () => {
    setDetailClaim(null);
    setDetailOpen(false);
    void navigate({
      to: APP_PATHS.tutor.sessions,
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
    setDetailClaim(null);
    setDetailOpen(false);
    void navigate({
      to: APP_PATHS.tutor.sessions,
      search: { claim: undefined },
      replace: true,
    });
  };

  const openDiscard = (claimIds: string[]) => {
    const draftIds = new Set(
      data.claims.filter((c) => c.status === "DRAFT").map((c) => c.id),
    );
    const safeIds = claimIds.filter((id) => draftIds.has(id));
    if (safeIds.length === 0) return;
    setResumeWorkspaceAfterDiscardCancel(
      detailOpen && safeIds.length === 1 && detailClaim?.id === safeIds[0],
    );
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

  const openWorkspace = (claim: TutorSessionClaimDTO) => {
    setDetailClaim(claim);
    setDetailOpen(true);
    void navigate({
      to: APP_PATHS.tutor.sessions,
      search: { claim: claim.id },
      replace: true,
    });
  };

  const onDragStart = (event: { active: { id: unknown; data: { current?: { columnId?: SessionKanbanColumnId } } } }) => {
    const claim = data.claims.find((c) => c.id === String(event.active.id));
    const columnId = event.active.data.current?.columnId;
    if (claim && columnId) setActiveDrag({ claim, columnId });
  };

  const onDragEnd = async (event: {
    active: { id: unknown; data: { current?: { columnId?: SessionKanbanColumnId } } };
    over: { id: unknown } | null;
  }) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const from = active.data.current?.columnId;
    const to = resolveKanbanDropColumn(String(over.id), data.columns);
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
      await data.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  };

  const discardConfirmClaim = useMemo(() => {
    if (discardTargetIds.length !== 1) return null;
    return (
      data.claims.find((c) => c.id === discardTargetIds[0]) ??
      (detailClaim?.id === discardTargetIds[0] ? detailClaim : null)
    );
  }, [data.claims, detailClaim, discardTargetIds]);

  return {
    workspaceTab,
    setWorkspaceTab,
    detailOpen,
    setDetailOpen,
    detailClaim,
    qrOpen,
    setQrOpen,
    qrClaim,
    setQrClaim,
    uploadOpen,
    setUploadOpen,
    uploadClaim,
    setUploadClaim,
    attendanceOpen,
    setAttendanceOpen,
    attendanceClaim,
    setAttendanceClaim,
    submitOpen,
    setSubmitOpen,
    submitClaim,
    setSubmitClaim,
    createOpen,
    setCreateOpen,
    resubmitClaim,
    setResubmitClaim,
    discardOpen,
    setDiscardOpen,
    discardTargetIds,
    setDiscardTargetIds,
    resumeWorkspaceAfterDiscardCancel,
    setResumeWorkspaceAfterDiscardCancel,
    draftSelectMode,
    setDraftSelectMode,
    selectedDraftIds,
    setSelectedDraftIds,
    activeDrag,
    setActiveDrag,
    openDiscard,
    exitDraftSelectMode,
    toggleDraftSelected,
    closeDetailSearch,
    finishDiscardSuccess,
    openWorkspace,
    onDragStart,
    onDragEnd,
    discardConfirmClaim,
  } as const;
}
