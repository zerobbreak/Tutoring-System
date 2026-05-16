import type { NavigateOptions } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  CalendarCheck,
  Loader2,
  QrCode,
  Scale,
  Video,
  XCircle,
} from "lucide-react";
import { CancelledScheduleRow } from "#/components/lecturer/sessions/cancelled-schedule-row";
import { SessionListSection } from "#/components/lecturer/sessions/session-list-section";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import type {
  AdminSessionCardDTO,
  AdminSessionsPageDataDTO,
  AdminSessionsSummaryDTO,
} from "#/server-actions/admin-sessions";
import { AdminSessionCard } from "./admin-session-card";
import { AdminSessionDetailSheet } from "./admin-session-detail-sheet";

const selectContentProps = {
  position: "popper" as const,
  className: "z-[200]",
};

export type AdminSessionsSearch = {
  claim?: string;
};

export type AdminSessionsViewProps = {
  booting: boolean;
  loadError: string | null;
  data: AdminSessionsPageDataDTO | null;
  lookbackDays: number;
  moduleId: string | null;
  tutorId: string | null;
  lecturerId: string | null;
  selectedClaimId: string | null;
  sheetOpen: boolean;
  onLookbackChange: (days: number) => void;
  onModuleChange: (id: string | null) => void;
  onTutorChange: (id: string | null) => void;
  onLecturerChange: (id: string | null) => void;
  navigate: (opts: NavigateOptions) => void | Promise<void>;
  onSheetOpenChange: (open: boolean) => void;
};

function formatRate(rate: number | null): string {
  if (rate == null) return "—";
  return `${Math.round(rate * 100)}%`;
}

function SessionsKpiStrip({
  booting,
  summary,
  lookbackDays,
}: {
  booting: boolean;
  summary: AdminSessionsSummaryDTO | undefined;
  lookbackDays: number;
}) {
  const items = [
    {
      label: "Active sessions",
      value: summary?.activeCount ?? 0,
      sub: "Today and upcoming",
      icon: Activity,
    },
    {
      label: "Completed",
      value: summary?.completedCount ?? 0,
      sub: `Last ${lookbackDays} days`,
      icon: CalendarCheck,
    },
    {
      label: "Cancelled",
      value: summary?.cancelledCount ?? 0,
      sub: "Schedule + rejected claims",
      icon: XCircle,
    },
    {
      label: "Avg attendance",
      value: formatRate(summary?.averageAttendanceRate ?? null),
      sub: "Present / expected",
      icon: BarChart3,
    },
    {
      label: "Open disputes",
      value: summary?.openDisputesCount ?? 0,
      sub: "Institution-wide",
      icon: Scale,
    },
    {
      label: "Missing registers",
      value: summary?.missingRegisterCount ?? 0,
      sub: `${summary?.liveQrCount ?? 0} live QR`,
      icon: QrCode,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium">{item.label}</CardTitle>
            <item.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {booting ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-xl font-bold">{item.value}</p>
            )}
            <p className="text-[11px] text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminSessionsView({
  booting,
  loadError,
  data,
  lookbackDays,
  moduleId,
  tutorId,
  lecturerId,
  selectedClaimId,
  sheetOpen,
  onLookbackChange,
  onModuleChange,
  onTutorChange,
  onLecturerChange,
  navigate,
  onSheetOpenChange,
}: AdminSessionsViewProps) {
  const openSession = (session: AdminSessionCardDTO | { id: string }) => {
    void navigate({
      to: "/admin/sessions",
      search: { claim: session.id },
      replace: true,
    });
  };

  const cancelledCount =
    (data?.cancelledSchedule.length ?? 0) + (data?.rejectedClaims.length ?? 0);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <header className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Video className="size-7 text-(--lagoon-deep)" />
              Sessions
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Institution-wide session monitoring — attendance, evidence, QR, and
              claim status across all modules.
            </p>
          </div>
          <Link
            to="/admin/attendance"
            className="text-sm font-medium text-(--lagoon-deep) underline-offset-4 hover:underline"
          >
            Full attendance analytics →
          </Link>
        </header>

        {loadError ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {loadError}
          </div>
        ) : null}

        <div className="grid shrink-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Module</Label>
            <Select
              value={moduleId ?? "__all__"}
              onValueChange={(v) => onModuleChange(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="All modules" />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="__all__">All modules</SelectItem>
                {(data?.modules ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.code} — {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tutor</Label>
            <Select
              value={tutorId ?? "__all__"}
              onValueChange={(v) => onTutorChange(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="All tutors" />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="__all__">All tutors</SelectItem>
                {(data?.tutors ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lecturer</Label>
            <Select
              value={lecturerId ?? "__all__"}
              onValueChange={(v) => onLecturerChange(v === "__all__" ? null : v)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="All lecturers" />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="__all__">All lecturers</SelectItem>
                {(data?.lecturers ?? []).map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Lookback</Label>
            <Select
              value={String(lookbackDays)}
              onValueChange={(v) => onLookbackChange(Number(v))}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent {...selectContentProps}>
                <SelectItem value="7">7 days</SelectItem>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <SessionsKpiStrip
          booting={booting}
          summary={data?.summary}
          lookbackDays={lookbackDays}
        />

        {booting ? (
          <div className="flex flex-1 justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="active" className="flex flex-col gap-4">
            <TabsList className="w-full justify-start sm:w-auto">
              <TabsTrigger value="active">
                Active ({data?.active.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed ({data?.completed.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelled ({cancelledCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-0">
              <SessionListSection
                title="Active sessions"
                description="Today and upcoming claims across the institution"
                count={data?.active.length ?? 0}
                emptyMessage="No active sessions in this period."
              >
                {(data?.active ?? []).map((session) => (
                  <li key={session.id}>
                    <AdminSessionCard
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
                emptyMessage="No completed sessions in this lookback window."
              >
                {(data?.completed ?? []).map((session) => (
                  <li key={session.id}>
                    <AdminSessionCard
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
                description="Slots cancelled on published schedules"
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
                    <AdminSessionCard
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
      </div>

      <AdminSessionDetailSheet
        claimId={selectedClaimId}
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
      />
    </div>
  );
}
