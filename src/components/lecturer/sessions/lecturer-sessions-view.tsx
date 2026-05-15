import type { NavigateOptions } from "@tanstack/react-router";
import { Loader2, Video } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  listLecturerSessionsFn,
  type LecturerSessionCardDTO,
  type LecturerSessionsPageDataDTO,
} from "#/server-actions/lecturer-sessions";
import { CancelledScheduleRow } from "./cancelled-schedule-row";
import { LecturerSessionCard } from "./lecturer-session-card";
import { LecturerSessionDetailSheet } from "./lecturer-session-detail-sheet";
import { SessionListSection } from "./session-list-section";

export type LecturerSessionsSearch = {
  claim?: string;
};

type LecturerSessionsViewProps = {
  search: LecturerSessionsSearch;
  navigate: (opts: NavigateOptions) => void | Promise<void>;
};

export function LecturerSessionsView({
  search,
  navigate,
}: LecturerSessionsViewProps) {
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<LecturerSessionsPageDataDTO | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listLecturerSessionsFn();
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load sessions",
      );
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.claim) {
      setSelectedClaimId(search.claim);
      setSheetOpen(true);
    }
  }, [search.claim]);

  const openSession = (session: LecturerSessionCardDTO | { id: string }) => {
    setSelectedClaimId(session.id);
    setSheetOpen(true);
    void navigate({
      to: "/lecturer/sessions",
      search: { claim: session.id },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSheetOpen(false);
      setSelectedClaimId(null);
      void navigate({
        to: "/lecturer/sessions",
        search: { claim: undefined },
        replace: true,
      });
    } else {
      setSheetOpen(true);
    }
  };

  const cancelledCount =
    (data?.cancelledSchedule.length ?? 0) + (data?.rejectedClaims.length ?? 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Video className="size-7 text-(--lagoon-deep)" />
            Sessions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor tutor sessions across your modules — attendance, evidence,
            notes, and claim status.
          </p>
        </div>

        {loadError ? (
          <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {booting ? (
          <div className="flex flex-1 justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="today" className="flex flex-col gap-4">
            <TabsList className="w-full justify-start sm:w-auto">
              <TabsTrigger value="today">
                Today ({data?.today.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="upcoming">
                Upcoming ({data?.upcoming.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({data?.completed.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled ({cancelledCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="mt-0">
              <SessionListSection
                title="Today"
                description="Sessions happening today on your modules"
                count={data?.today.length ?? 0}
                emptyMessage="No sessions scheduled for today."
              >
                {(data?.today ?? []).map((session) => (
                  <li key={session.id}>
                    <LecturerSessionCard
                      session={session}
                      selected={selectedClaimId === session.id && sheetOpen}
                      onSelect={openSession}
                    />
                  </li>
                ))}
              </SessionListSection>
            </TabsContent>

            <TabsContent value="upcoming" className="mt-0">
              <SessionListSection
                title="Upcoming"
                description="Future sessions not yet completed"
                count={data?.upcoming.length ?? 0}
                emptyMessage="No upcoming sessions."
              >
                {(data?.upcoming ?? []).map((session) => (
                  <li key={session.id}>
                    <LecturerSessionCard
                      session={session}
                      selected={selectedClaimId === session.id && sheetOpen}
                      onSelect={openSession}
                    />
                  </li>
                ))}
              </SessionListSection>
            </TabsContent>

            <TabsContent value="completed" className="mt-0">
              <SessionListSection
                title="Completed"
                description="Past sessions by calendar time"
                count={data?.completed.length ?? 0}
                emptyMessage="No completed sessions yet."
              >
                {(data?.completed ?? []).map((session) => (
                  <li key={session.id}>
                    <LecturerSessionCard
                      session={session}
                      selected={selectedClaimId === session.id && sheetOpen}
                      onSelect={openSession}
                    />
                  </li>
                ))}
              </SessionListSection>
            </TabsContent>

            <TabsContent value="cancelled" className="mt-0 space-y-4">
              <SessionListSection
                title="Schedule cancellations"
                description="Slots cancelled on the lecturer schedule (not rejected payroll claims)"
                count={data?.cancelledSchedule.length ?? 0}
                emptyMessage="No cancelled schedule slots."
              >
                {(data?.cancelledSchedule ?? []).map((row) => (
                  <li key={row.id}>
                    <CancelledScheduleRow
                      row={row}
                      onOpenClaim={
                        row.linked_claim_id
                          ? (id) => openSession({ id })
                          : undefined
                      }
                    />
                  </li>
                ))}
              </SessionListSection>

              <SessionListSection
                title="Rejected claims"
                description="Payroll claims rejected during verification"
                count={data?.rejectedClaims.length ?? 0}
                emptyMessage="No rejected claims."
              >
                {(data?.rejectedClaims ?? []).map((session) => (
                  <li key={session.id}>
                    <LecturerSessionCard
                      session={session}
                      selected={selectedClaimId === session.id && sheetOpen}
                      onSelect={openSession}
                    />
                  </li>
                ))}
              </SessionListSection>
            </TabsContent>
          </Tabs>
        )}

        <LecturerSessionDetailSheet
          claimId={selectedClaimId}
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
        />
      </div>
    </div>
  );
}
