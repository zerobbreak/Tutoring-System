import {
  DndContext,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
  type SensorDescriptor,
  type SensorOptions,
} from "@dnd-kit/core";
import { ClipboardList } from "lucide-react";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import {
  COLUMN_META,
  kanbanCollisionDetection,
} from "#/components/tutor/sessions/tutor-sessions-board-meta";
import {
  isSessionLive,
  isSessionUrgent,
} from "#/components/tutor/sessions/tutor-sessions-workspace-helpers";
import {
  DroppableColumn,
  DraggableSessionCard,
  KanbanColumnHeader,
  KanbanDragOverlay,
  AnimatePresence,
  motion,
} from "#/components/tutor/sessions/tutor-session-kanban-card";
import type { SessionKanbanColumnId } from "#/lib/session-kanban-column";
import { SESSION_REQUEST_STATUS } from "#/lib/session-request-status";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

type TutorSessionsKanbanBoardProps = {
  loading: boolean;
  columns: Record<SessionKanbanColumnId, TutorSessionClaimDTO[]>;
  now: Date;
  reduceMotion: boolean | null;
  sensors: SensorDescriptor<SensorOptions>[];
  activeDrag: {
    claim: TutorSessionClaimDTO;
    columnId: SessionKanbanColumnId;
  } | null;
  draftSelectMode: boolean;
  selectedDraftIds: Set<string>;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onOpenWorkspace: (claim: TutorSessionClaimDTO) => void;
  onQr: (claim: TutorSessionClaimDTO) => void;
  onUpload: (claim: TutorSessionClaimDTO) => void;
  onAttendance: (claim: TutorSessionClaimDTO) => void;
  onSubmit: (claim: TutorSessionClaimDTO) => void;
  onDiscard: (claimId: string) => void;
  onEditRequest: (claim: TutorSessionClaimDTO) => void;
  onToggleDraftSelect: (claimId: string) => void;
};

export function TutorSessionsKanbanBoard({
  loading,
  columns,
  now,
  reduceMotion,
  sensors,
  activeDrag,
  draftSelectMode,
  selectedDraftIds,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onOpenWorkspace,
  onQr,
  onUpload,
  onAttendance,
  onSubmit,
  onDiscard,
  onEditRequest,
  onToggleDraftSelect,
}: TutorSessionsKanbanBoardProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[420px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={kanbanCollisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <div className="flex h-full min-h-[280px] gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:gap-4 2xl:grid 2xl:grid-cols-4 2xl:gap-4 2xl:overflow-visible 2xl:pb-0">
        {(Object.keys(COLUMN_META) as SessionKanbanColumnId[]).map((colId) => (
          <DroppableColumn
            key={colId}
            id={colId}
            className="flex h-[min(65vh,640px)] min-h-[280px] w-[min(88vw,19rem)] shrink-0 snap-center flex-col sm:w-[min(42vw,20rem)] 2xl:h-[min(70vh,720px)] 2xl:w-auto 2xl:min-w-0 2xl:max-w-none"
          >
            <KanbanColumnHeader colId={colId} count={columns[colId].length} />
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex min-h-full flex-col gap-2 px-2 pb-3 pt-2">
                <AnimatePresence initial={false}>
                  {columns[colId].length === 0 ? (
                    <motion.div
                      key="empty"
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
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
                        onOpen={() => onOpenWorkspace(c)}
                        onQr={() => onQr(c)}
                        onUpload={() => onUpload(c)}
                        onAttendance={() => onAttendance(c)}
                        onSubmit={() => onSubmit(c)}
                        onWorkspace={() => onOpenWorkspace(c)}
                        onDiscard={
                          c.status === "DRAFT" ? () => onDiscard(c.id) : undefined
                        }
                        onEditRequest={
                          c.request_status ===
                          SESSION_REQUEST_STATUS.CHANGES_REQUESTED
                            ? () => onEditRequest(c)
                            : undefined
                        }
                        draftSelectMode={draftSelectMode}
                        draftSelected={selectedDraftIds.has(c.id)}
                        onToggleDraftSelect={() => onToggleDraftSelect(c.id)}
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
        {activeDrag ? <KanbanDragOverlay claim={activeDrag.claim} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
