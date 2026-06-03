import {
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useReducedMotion } from "framer-motion";
import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Tabs, TabsContent } from "#/components/ui/tabs";
import { TooltipProvider } from "#/components/ui/tooltip";
import { TutorSessionsKanbanBoard } from "#/components/tutor/sessions/tutor-sessions-kanban-board";
import {
  TutorSessionsPageHeader,
  TutorSessionsToolbar,
} from "#/components/tutor/sessions/tutor-sessions-page-chrome";
import { TutorSessionsTableView } from "#/components/tutor/sessions/tutor-sessions-table-view";
import { TutorSessionsWorkspaceDialogs } from "#/components/tutor/sessions/tutor-sessions-workspace-dialogs";
import { useTutorSessionsWorkspaceState } from "#/components/tutor/sessions/use-tutor-sessions-workspace-state";
import { useTutorSessionsWorkspaceData } from "#/components/tutor/sessions/use-tutor-sessions-workspace-data";
import { useSessionUser } from "#/lib/use-session-user";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

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
  const data = useTutorSessionsWorkspaceData(user?.id ?? null);

  const workspaceState = useTutorSessionsWorkspaceState({
    search,
    data,
    navigate,
  });

  const {
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
  } = workspaceState;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 6 },
    }),
  );

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

        <TutorSessionsWorkspaceDialogs
          detailOpen={detailOpen}
          detailClaim={detailClaim}
          qrOpen={qrOpen}
          qrClaim={qrClaim}
          uploadOpen={uploadOpen}
          uploadClaim={uploadClaim}
          attendanceOpen={attendanceOpen}
          attendanceClaim={attendanceClaim}
          submitOpen={submitOpen}
          submitClaim={submitClaim}
          createOpen={createOpen}
          resubmitClaim={resubmitClaim}
          discardOpen={discardOpen}
          discardTargetIds={discardTargetIds}
          onDetailOpenChange={(open) => {
            if (!open) closeDetailSearch();
          }}
          onQrOpenChange={setQrOpen}
          onUploadOpenChange={setUploadOpen}
          onAttendanceOpenChange={setAttendanceOpen}
          onSubmitOpenChange={setSubmitOpen}
          onCreateOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setResubmitClaim(null);
          }}
          onDiscardOpenChange={(open) => {
            setDiscardOpen(open);
            if (!open) {
              setDiscardTargetIds([]);
              if (resumeWorkspaceAfterDiscardCancel && detailClaim) {
                setDetailOpen(true);
              }
              setResumeWorkspaceAfterDiscardCancel(false);
            }
          }}
          confirmDiscardClaim={discardConfirmClaim}
          onDiscardClaim={(id) => openDiscard([id])}
          onSubmitClaim={(claim: TutorSessionClaimDTO) => {
            setSubmitClaim(claim);
            setSubmitOpen(true);
          }}
          onRefresh={() => {
            void data.reload();
          }}
          onDiscarded={async (ids) => {
            finishDiscardSuccess(ids);
            exitDraftSelectMode();
            await data.reload();
          }}
        />
      </div>
    </TooltipProvider>
  );
}
