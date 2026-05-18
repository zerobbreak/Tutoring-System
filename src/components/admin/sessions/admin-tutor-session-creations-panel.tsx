import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import { Check, Loader2, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { toast } from "#/lib/toast";
import {
  approveTutorSessionCreationFn,
  listPendingTutorSessionCreationsFn,
  rejectTutorSessionCreationFn,
  type PendingTutorSessionCreationDTO,
} from "#/server-actions/admin-sessions";

function formatRequestedAt(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return format(d, "MMM d, yyyy HH:mm");
}

export function AdminTutorSessionCreationsPanel({
  items: controlledItems,
  loading: controlledLoading,
  onChanged,
  showViewAllLink = false,
}: {
  /** When set, skips client fetch (e.g. admin dashboard loader). */
  items?: PendingTutorSessionCreationDTO[];
  loading?: boolean;
  onChanged?: () => void;
  showViewAllLink?: boolean;
}) {
  const isControlled = controlledItems !== undefined;
  const [loading, setLoading] = useState(!isControlled);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTutorSessionCreationDTO[]>(
    controlledItems ?? [],
  );

  const load = useCallback(async () => {
    if (isControlled) return;
    setLoading(true);
    try {
      const rows = await listPendingTutorSessionCreationsFn();
      setPending(rows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load tutor session requests",
      );
    } finally {
      setLoading(false);
    }
  }, [isControlled]);

  useEffect(() => {
    if (isControlled) {
      setPending(controlledItems);
      return;
    }
    void load();
  }, [isControlled, controlledItems, load]);

  const refresh = async () => {
    if (isControlled) {
      onChanged?.();
    } else {
      await load();
    }
  };

  const approve = async (claimId: string) => {
    setBusyId(claimId);
    try {
      await approveTutorSessionCreationFn({ data: { claimId } });
      toast.success("Session approved for tutor");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (claimId: string) => {
    if (
      !window.confirm(
        "Reject this session request? The draft will be removed.",
      )
    ) {
      return;
    }
    setBusyId(claimId);
    try {
      await rejectTutorSessionCreationFn({ data: { claimId } });
      toast.success("Session request rejected");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reject");
    } finally {
      setBusyId(null);
    }
  };

  const showLoading = isControlled ? (controlledLoading ?? false) : loading;

  if (showLoading) {
    return (
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4" />
            Tutor session requests
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    );
  }

  if (pending.length === 0) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="size-4 text-amber-700 dark:text-amber-300" />
            Tutor session requests
          </CardTitle>
          <CardDescription>
            {pending.length} tutor-created session
            {pending.length === 1 ? "" : "s"} awaiting approval before they appear
            on the tutor board.
          </CardDescription>
        </div>
        {showViewAllLink ? (
          <Button variant="ghost" size="sm" className="shrink-0" asChild>
            <Link to="/admin/sessions">All sessions</Link>
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="divide-y rounded-md border bg-card/80">
          {pending.map((row) => {
            const busy = busyId === row.id;
            const tutorName =
              row.tutor?.full_name?.trim() || row.tutor?.email || "Tutor";
            const moduleLabel = row.module
              ? `${row.module.code} — ${row.module.name}`
              : "Module";
            return (
              <li
                key={row.id}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">{moduleLabel}</p>
                  <p className="text-muted-foreground">
                    {tutorName} · {row.session_date} ·{" "}
                    {row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}
                    {row.venue ? ` · ${row.venue}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested {formatRequestedAt(row.updated_at)}
                  </p>
                </div>
                <SessionRequestActions
                  busy={busy}
                  onApprove={() => void approve(row.id)}
                  onReject={() => void reject(row.id)}
                />
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function SessionRequestActions({
  busy,
  onApprove,
  onReject,
}: {
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" disabled={busy} onClick={onApprove}>
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Check className="size-4" />
        )}
        Approve
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={onReject}>
        <X className="size-4" />
        Reject
      </Button>
    </div>
  );
}
