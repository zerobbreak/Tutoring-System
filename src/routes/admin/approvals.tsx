import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/admin/approvals")({
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  return <LecturerPlaceholderPage title="Approvals" />;
}
