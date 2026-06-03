import { format } from "date-fns";
import { CheckCircle2, ClipboardList, Loader2 } from "lucide-react";
import { QueryEmptyState, QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { Badge } from "#/components/ui/badge";
import { Card, CardContent } from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Skeleton } from "#/components/ui/skeleton";
import type {
  AuditFeedCategory,
  AuditLogFeedEntryDTO,
  AuditLogFeedPageDTO,
} from "#/server-actions/admin-audit-logs";
import type { AdminUserRowDTO } from "#/server-actions/admin-users";

const selectContentProps = {
  position: "popper" as const,
  className: "z-[200]",
};

const CATEGORY_LABELS: Record<AuditFeedCategory, string> = {
  ALL: "All events",
  APPROVAL: "Approvals & claims",
  SCHEDULE: "Schedule",
  MFA: "MFA",
  USER: "User admin",
  SECURITY: "Security",
};

export type AdminAuditLogsViewProps = {
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  data: AuditLogFeedPageDTO | null;
  users: AdminUserRowDTO[];
  category: AuditFeedCategory;
  actorId: string | null;
  moduleId: string | null;
  dateFrom: string;
  dateTo: string;
  onCategoryChange: (category: AuditFeedCategory) => void;
  onActorChange: (id: string | null) => void;
  onModuleChange: (id: string | null) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
};

function AuditEntryRow({ entry }: { entry: AuditLogFeedEntryDTO }) {
  const when = format(new Date(entry.occurredAt), "yyyy-MM-dd HH:mm");
  const showMfa =
    entry.mfaConfirmed === true ||
    (entry.source === "verification" && entry.mfaConfirmed != null);

  return (
    <li className="border-b border-border/60 py-4 last:border-0">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <time
          dateTime={entry.occurredAt}
          className="font-mono text-xs text-muted-foreground"
        >
          {when}
        </time>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          {CATEGORY_LABELS[entry.category]}
        </Badge>
      </div>
      <p className="mt-1 text-sm font-medium leading-snug">{entry.summary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {entry.actor ? (
          <span>
            {entry.actor.fullName}{" "}
            <span className="text-muted-foreground/80">({entry.actor.role})</span>
          </span>
        ) : null}
        {entry.module ? (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
            {entry.module.code}
          </span>
        ) : null}
        {entry.claimId ? (
          <span className="font-mono">Claim #{entry.claimId.slice(0, 8)}</span>
        ) : null}
        {showMfa ? (
          <span
            className={
              entry.mfaConfirmed
                ? "inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400"
                : "inline-flex items-center gap-1"
            }
          >
            {entry.mfaConfirmed ? (
              <CheckCircle2 className="size-3.5" aria-hidden />
            ) : null}
            MFA {entry.mfaConfirmed ? "confirmed" : "not confirmed"}
          </span>
        ) : null}
        <span>
          IP: {entry.ipAddress ?? "—"}
        </span>
      </div>
      {entry.comment ? (
        <p className="mt-2 text-xs italic text-muted-foreground">
          {entry.comment}
        </p>
      ) : null}
    </li>
  );
}

export function AdminAuditLogsView({
  booting,
  loadError,
  onRetryLoad,
  retryingLoad,
  data,
  users,
  category,
  actorId,
  moduleId,
  dateFrom,
  dateTo,
  onCategoryChange,
  onActorChange,
  onModuleChange,
  onDateFromChange,
  onDateToChange,
}: AdminAuditLogsViewProps) {
  const entries = data?.entries ?? [];
  const modules = data?.modules ?? [];

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardList className="size-7 text-(--lagoon-deep)" />
            Audit logs
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Institutional accountability: approvals, schedule reviews, MFA, and
            admin actions.
          </p>
        </div>

        {loadError ? (
          <QueryErrorBanner
            message={loadError}
            onRetry={onRetryLoad}
            retrying={retryingLoad}
          />
        ) : null}

        <Card>
          <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <div className="space-y-2">
              <Label htmlFor="audit-category">Event type</Label>
              <Select
                value={category}
                onValueChange={(v) => onCategoryChange(v as AuditFeedCategory)}
              >
                <SelectTrigger id="audit-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  {(Object.keys(CATEGORY_LABELS) as AuditFeedCategory[]).map(
                    (key) => (
                      <SelectItem key={key} value={key}>
                        {CATEGORY_LABELS[key]}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-actor">User</Label>
              <Select
                value={actorId ?? "all"}
                onValueChange={(v) => onActorChange(v === "all" ? null : v)}
              >
                <SelectTrigger id="audit-actor" className="w-full">
                  <SelectValue placeholder="All users" />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  <SelectItem value="all">All users</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-module">Module</Label>
              <Select
                value={moduleId ?? "all"}
                onValueChange={(v) => onModuleChange(v === "all" ? null : v)}
              >
                <SelectTrigger id="audit-module" className="w-full">
                  <SelectValue placeholder="All modules" />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  <SelectItem value="all">All modules</SelectItem>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.code} — {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                type="date"
                value={dateFrom}
                onChange={(e) => onDateFromChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                type="date"
                value={dateTo}
                onChange={(e) => onDateToChange(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            {booting ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <QueryEmptyState description="No audit events match these filters." />
            ) : (
              <ul className="divide-y-0">
                {entries.map((entry) => (
                  <AuditEntryRow key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
            {booting ? (
              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading…
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
