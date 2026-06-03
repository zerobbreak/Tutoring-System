import { format, parseISO } from "date-fns";
import {
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FileWarning,
  Send,
} from "lucide-react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { claimStatusRail } from "#/components/tutor/sessions/tutor-sessions-workspace-helpers";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
  type ClaimStatus,
} from "#/lib/session-claim-display";
import { cn } from "#/lib/utils";
import type { TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";

type TutorSessionsTableViewProps = {
  loading: boolean;
  claims: TutorSessionClaimDTO[];
  draftSelectMode: boolean;
  visibleDrafts: TutorSessionClaimDTO[];
  selectedDraftIds: Set<string>;
  onToggleDraftSelect: (claimId: string) => void;
  onSelectAllDrafts: () => void;
  onClearDraftSelection: () => void;
  onOpenWorkspace: (claim: TutorSessionClaimDTO) => void;
  onSubmit: (claim: TutorSessionClaimDTO) => void;
};

export function TutorSessionsTableView({
  loading,
  claims,
  draftSelectMode,
  visibleDrafts,
  selectedDraftIds,
  onToggleDraftSelect,
  onSelectAllDrafts,
  onClearDraftSelection,
  onOpenWorkspace,
  onSubmit,
}: TutorSessionsTableViewProps) {
  return (
    <>
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
                      visibleDrafts.every((c) => selectedDraftIds.has(c.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) onSelectAllDrafts();
                      else onClearDraftSelection();
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
            ) : claims.length === 0 ? (
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
                        Adjust search, module, date, or status filters to see
                        sessions here.
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              claims.map((claim, index) => {
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
                        onToggleDraftSelect(claim.id);
                        return;
                      }
                      onOpenWorkspace(claim);
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
                            onChange={() => onToggleDraftSelect(claim.id)}
                            className="size-4 rounded border-input accent-(--lagoon-deep)"
                            aria-label={`Select ${claim.module?.code ?? "draft"} session`}
                          />
                        ) : null}
                      </TableCell>
                    ) : null}
                    <TableCell className="px-4 py-3.5 align-top whitespace-normal">
                      <p className="font-semibold tabular-nums text-foreground">
                        {format(parseISO(claim.session_date), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(claim.session_date), "EEEE")}
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
                      <Badge variant="secondary" className="font-normal capitalize">
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
                            onSubmit(claim);
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
      {claims.length > 0 && !loading ? (
        <div className="shrink-0 border-t border-border/60 bg-muted/10 px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
          Showing{" "}
          <span className="font-medium tabular-nums text-foreground">
            {claims.length}
          </span>{" "}
          session{claims.length === 1 ? "" : "s"} · newest first
        </div>
      ) : null}
    </>
  );
}
