import { createFileRoute } from "@tanstack/react-router";
import { AdminAnalyticsView } from "#/components/admin/analytics/admin-analytics-view";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalyticsPage,
});

function AdminAnalyticsPage() {
  return (
    <div className="p-6 md:p-8">
      <AdminAnalyticsView />
    </div>
  );
}
