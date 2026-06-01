import {
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useReducedMotion } from "framer-motion";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Tabs, TabsContent } from "#/components/ui/tabs";
import { TooltipProvider } from "#/components/ui/tooltip";
import { SubmitClaimDialog } from "#/components/tutor/sessions/submit-claim-dialog";
import { TutorDiscardDraftsDialog } from "#/components/tutor/sessions/tutor-discard-drafts-dialog";
import { TutorRequestSessionDialog } from "#/components/tutor/sessions/tutor-request-session-dialog";
import { TutorSessionAttendanceDialog } from "#/components/tutor/sessions/tutor-session-attendance-dialog";
import { TutorSessionQrDialog } from "#/components/tutor/sessions/tutor-session-qr-dialog";
import { TutorSessionRegisterUploadDialog } from "#/components/tutor/sessions/tutor-session-register-upload-dialog";
import { TutorSessionWorkspaceDialog } from "#/components/tutor/sessions/tutor-session-workspace-dialog";
import {
  COLUMN_META,
  resolveKanbanDropColumn,
} from "#/components/tutor/sessions/tutor-sessions-board-meta";
import { TutorSessionsKanbanBoard } from "#/components/tutor/sessions/tutor-sessions-kanban-board";
import {
  TutorSessionsPageHeader,
  TutorSessionsToolbar,
} from "#/components/tutor/sessions/tutor-sessions-page-chrome";
import { TutorSessionsTableView } from "#/components/tutor/sessions/tutor-sessions-table-view";
import { workspaceClaimFromDetails } from "#/components/tutor/sessions/tutor-sessions-workspace-helpers";
import { useTutorSessionsWorkspaceData } from "#/components/tutor/sessions/use-tutor-sessions-workspace-data";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";
import { toast } from "#/lib/toast";
import { useSessionUser } from "#/lib/use-session-user";
import {
  getClaimDetailsFn,
  updateSessionClaimSchedulingFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

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
  const recentlyDiscardedClaimIds = useRef<Set<string>>(new Set());

  const data = useTutorSessionsWorkspaceData(user?.id ?? null);

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
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceClaim, setAttendanceClaim] =
    useState<TutorSessionClaimDTO | null>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitClaim, setSubmitClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [resubmitClaim, setResubmitClaim] =
    useState<TutorSessionClaimDTO | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardTargetIds, setDiscardTargetIds] = useState<string[]>([]);
  const [resumeWorkspaceAfterDiscardCancel, setResumeWorkspaceAfterDiscardCancel] =
    useState(false);
  const [draftSelectMode, setDraftSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [activeDrag, setActiveDrag] = useState<{
    claim: TutorSessionClaimDTO;
    columnId: SessionKanbanColumnId;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

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
          setDetailClaim(null);
          setDetailOpen(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.claim, data.claims, data.loading, navigate]);

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
      ? data.claims.find((c) => c.id === discardTargetIds[0]) ??
        (detailClaim?.id === discardTargetIds[0] ? detailClaim : null)
      : null;

  const openWorkspace = (c: TutorSessionClaimDTO) => {
    setDetailClaim(c);
    setDetailOpen(true);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: c.id },
      replace: true,
    });
  };

  const onDragStart = (event: DragStartEvent) => {
    const claim = data.claims.find((c) => c.id === String(event.active.id));
    const columnId = event.active.data.current?.columnId as
      | SessionKanbanColumnId
      | undefined;
    if (claim && columnId) setActiveDrag({ claim, columnId });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const from = active.data.current?.columnId as SessionKanbanColumnId | undefined;
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

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-4 p-3 sm:space-y-5 sm:p-4 md:p-6 lg:p-8">
            <TutorSessionsPageHeader
              onCreateSession={() => setCreateOpen(true)}
              loading={data.loading}
              hourBudget={data.hourBudget}
              stats={data.stats}
              columnCounts={{
                claimsPending: data.columns.claimsPending.length,
                today: data.columns.today.length,
                upcoming: data.columns.upcoming.length,
                completed: data.columns.completed.length,
              }}
            />

            <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
              <TutorSessionsToolbar
                embedded
                searchText={data.searchText}
                onSearchChange={data.setSearchText}
                moduleFilter={data.moduleFilter}
                onModuleFilter={data.setModuleFilter}
                moduleOptions={data.moduleOptions}
                dateFilter={data.dateFilter}
                onDateFilter={data.setDateFilter}
                datePickOpen={data.datePickOpen}
                onDatePickOpen={data.setDatePickOpen}
                datePickTemp={data.datePickTemp}
                onDatePickTemp={data.setDatePickTemp}
                statusFilters={data.statusFilters}
                onToggleStatus={data.toggleStatus}
                workspaceTab={workspaceTab}
                onWorkspaceTabChange={(v) =>
                  setWorkspaceTab(v === "table" ? "table" : "kanban")
                }
                onClearFilters={data.clearFilters}
                draftSelectSlot={
                  data.visibleDrafts.length > 0 ? (
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

              {draftSelectMode && data.visibleDrafts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 bg-lagoon/5 px-3 py-2 text-sm sm:px-4">
                  <span className="font-medium text-foreground">
                    {selectedDraftIds.size} of {data.visibleDrafts.length}{" "}
                    selected
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedDraftIds(
                        new Set(data.visibleDrafts.map((c) => c.id)),
                      )
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
                  onValueChange={(v) =>
                    setWorkspaceTab(v === "table" ? "table" : "kanban")
                  }
                  className="flex flex-col"
                >
                  <TabsContent
                    value="kanban"
                    className="mt-0 flex flex-col p-3 data-[state=inactive]:hidden sm:p-4"
                  >
                    <TutorSessionsKanbanBoard
                      loading={data.loading}
                      columns={data.columns}
                      now={data.now}
                      reduceMotion={reduceMotion}
                      sensors={sensors}
                      activeDrag={activeDrag}
                      draftSelectMode={draftSelectMode}
                      selectedDraftIds={selectedDraftIds}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                      onDragCancel={() => setActiveDrag(null)}
                      onOpenWorkspace={openWorkspace}
                      onQr={(c) => {
                        setQrClaim(c);
                        setQrOpen(true);
                      }}
                      onUpload={(c) => {
                        setUploadClaim(c);
                        setUploadOpen(true);
                      }}
                      onAttendance={(c) => {
                        setAttendanceClaim(c);
                        setAttendanceOpen(true);
                      }}
                      onSubmit={(c) => {
                        setSubmitClaim(c);
                        setSubmitOpen(true);
                      }}
                      onDiscard={(id) => openDiscard([id])}
                      onEditRequest={(c) => {
                        setResubmitClaim(c);
                        setCreateOpen(true);
                      }}
                      onToggleDraftSelect={toggleDraftSelected}
                    />
                  </TabsContent>

                  <TabsContent
                    value="table"
                    className="mt-0 flex flex-col data-[state=inactive]:hidden"
                  >
                    <TutorSessionsTableView
                      loading={data.loading}
                      claims={data.tableSortedClaims}
                      draftSelectMode={draftSelectMode}
                      visibleDrafts={data.visibleDrafts}
                      selectedDraftIds={selectedDraftIds}
                      onToggleDraftSelect={toggleDraftSelected}
                      onSelectAllDrafts={() =>
                        setSelectedDraftIds(
                          new Set(data.visibleDrafts.map((c) => c.id)),
                        )
                      }
                      onClearDraftSelection={() => setSelectedDraftIds(new Set())}
                      onOpenWorkspace={openWorkspace}
                      onSubmit={(c) => {
                        setSubmitClaim(c);
                        setSubmitOpen(true);
                      }}
                    />
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

        <TutorSessionWorkspaceDialog
          open={detailOpen}
          claim={detailClaim}
          onOpenChange={(o) => {
            if (!o) closeDetailSearch();
          }}
          onSubmit={(c) => {
            setSubmitClaim(c);
            setSubmitOpen(true);
          }}
          onDiscard={(id) => openDiscard([id])}
        />

        <TutorSessionQrDialog
          open={qrOpen}
          onOpenChange={setQrOpen}
          claim={qrClaim}
        />

        <TutorSessionRegisterUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          claim={uploadClaim}
          onUploaded={data.reload}
        />

        <TutorSessionAttendanceDialog
          open={attendanceOpen}
          onOpenChange={setAttendanceOpen}
          claim={attendanceClaim}
          onUpdated={data.reload}
        />

        <SubmitClaimDialog
          claim={submitClaim}
          open={submitOpen}
          onOpenChange={setSubmitOpen}
          onSubmitted={data.reload}
        />

        <TutorDiscardDraftsDialog
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
          targetIds={discardTargetIds}
          confirmClaim={discardConfirmClaim}
          onDiscarded={async (ids) => {
            finishDiscardSuccess(ids);
            exitDraftSelectMode();
            await data.reload();
          }}
        />

        <TutorRequestSessionDialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setResubmitClaim(null);
          }}
          resubmitClaim={resubmitClaim}
          onSaved={() => data.reload({ silent: true })}
        />
      </div>
    </TooltipProvider>
  );
}
