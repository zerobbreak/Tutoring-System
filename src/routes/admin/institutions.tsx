import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/admin/institutions")({
  component: AdminInstitutionsPage,
});

function AdminInstitutionsPage() {
  return <LecturerPlaceholderPage title="Institutions" />;
}
