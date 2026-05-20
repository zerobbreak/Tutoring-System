import { createFileRoute } from "@tanstack/react-router";
import { AdminReportsView } from "#/components/admin/reports/admin-reports-view";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReportsPage,
});

function AdminReportsPage() {
  return <AdminReportsView />;
}
