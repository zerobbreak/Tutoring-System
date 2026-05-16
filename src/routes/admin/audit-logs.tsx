import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { AdminAuditLogsView } from "#/components/admin/audit-logs/admin-audit-logs-view";
import { useSessionUser } from "#/lib/use-session-user";
import {
  listAuditLogFeedFn,
  type AuditFeedCategory,
  type AuditLogFeedPageDTO,
} from "#/server-actions/admin-audit-logs";
import {
  listAdminUsersFn,
  type AdminUserRowDTO,
} from "#/server-actions/admin-users";

function dateInputToIsoStart(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T00:00:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function dateInputToIsoEnd(date: string): string | undefined {
  if (!date) return undefined;
  const d = new Date(`${date}T23:59:59.999`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export const Route = createFileRoute("/admin/audit-logs")({
  component: AdminAuditLogsPage,
});

function AdminAuditLogsPage() {
  const { user } = useSessionUser();

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AuditLogFeedPageDTO | null>(null);
  const [users, setUsers] = useState<AdminUserRowDTO[]>([]);

  const [category, setCategory] = useState<AuditFeedCategory>("ALL");
  const [actorId, setActorId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!user) return;
    void listAdminUsersFn({ data: { category: "all" } })
      .then((res) => setUsers(res.users))
      .catch(() => setUsers([]));
  }, [user?.id]);

  const loadFeed = useCallback(async () => {
    if (!user) return;
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listAuditLogFeedFn({
        data: {
          category,
          actorId: actorId ?? undefined,
          moduleId: moduleId ?? undefined,
          from: dateInputToIsoStart(dateFrom),
          to: dateInputToIsoEnd(dateTo),
        },
      });
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load audit logs",
      );
    } finally {
      setBooting(false);
    }
  }, [user, category, actorId, moduleId, dateFrom, dateTo]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void loadFeed();
  }, [user?.id, loadFeed]);

  return (
    <AdminAuditLogsView
      booting={booting}
      loadError={loadError}
      data={data}
      users={users}
      category={category}
      actorId={actorId}
      moduleId={moduleId}
      dateFrom={dateFrom}
      dateTo={dateTo}
      onCategoryChange={setCategory}
      onActorChange={setActorId}
      onModuleChange={setModuleId}
      onDateFromChange={setDateFrom}
      onDateToChange={setDateTo}
    />
  );
}
