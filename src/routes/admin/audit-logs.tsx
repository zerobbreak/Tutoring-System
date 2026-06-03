import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminAuditLogsView } from "#/components/admin/audit-logs/admin-audit-logs-view";
import { useAdminAuditLogsData } from "#/components/admin/audit-logs/use-admin-audit-logs-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { useSessionUser } from "#/lib/use-session-user";
import type { AuditFeedCategory } from "#/server-actions/admin-audit-logs";

export const Route = createFileRoute("/admin/audit-logs")({
  component: AdminAuditLogsPage,
});

function AdminAuditLogsPage() {
  const { user, pending } = useSessionUser();

  const [category, setCategory] = useState<AuditFeedCategory>("ALL");
  const [actorId, setActorId] = useState<string | null>(null);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const {
    users,
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
  } = useAdminAuditLogsData({
    enabled: !!user,
    filters: { category, actorId, moduleId, dateFrom, dateTo },
  });
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading audit logs…"
    >
      <AdminAuditLogsView
        booting={isLoading}
        {...feedback}
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
    </QueryPageGate>
  );
}
