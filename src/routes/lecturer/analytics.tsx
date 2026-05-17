import { createFileRoute } from "@tanstack/react-router";
import { LecturerAnalyticsView } from "#/components/lecturer/analytics/lecturer-analytics-view";
import { ScrollArea } from "#/components/ui/scroll-area";

export const Route = createFileRoute("/lecturer/analytics")({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <LecturerAnalyticsView />
    </ScrollArea>
  );
}
