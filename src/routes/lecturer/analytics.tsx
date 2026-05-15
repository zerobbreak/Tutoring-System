import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <LecturerPlaceholderPage title="Analytics" />;
}
