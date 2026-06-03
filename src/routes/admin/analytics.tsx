import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalyticsView } from "#/components/admin/analytics/admin-analytics-view";
import { ScrollArea } from "#/components/ui/scroll-area";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  return (
    <ScrollArea className="min-h-0 flex-1">
      <AdminAnalyticsView />
    </ScrollArea>
  );
}
