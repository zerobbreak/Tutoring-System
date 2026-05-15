import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/settings")({
  component: LecturerSettingsPage,
});

function LecturerSettingsPage() {
  return <LecturerPlaceholderPage title="Settings" />;
}
