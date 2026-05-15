import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/messages")({
  component: MessagesPage,
});

function MessagesPage() {
  return <LecturerPlaceholderPage title="Messages" />;
}
