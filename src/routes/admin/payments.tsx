import { createFileRoute } from "@tanstack/react-router";
import { AdminPayrollView } from "#/components/admin/payroll/admin-payroll-view";

export const Route = createFileRoute("/admin/payments")({
  component: AdminPaymentsPage,
});

function AdminPaymentsPage() {
  return <AdminPayrollView />;
}
