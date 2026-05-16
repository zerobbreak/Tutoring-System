import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/admin/messaging")({
  component: AdminMessagingPage,
});

function AdminMessagingPage() {
  return <LecturerPlaceholderPage title="Messaging" />;
}
