import { createFileRoute } from "@tanstack/react-router";
import { LecturerAnalyticsView } from "#/components/lecturer/analytics/lecturer-analytics-view";

export const Route = createFileRoute("/lecturer/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <LecturerAnalyticsView />;
}
