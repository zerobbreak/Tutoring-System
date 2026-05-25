import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/tutor/notifications")({
  component: TutorNotificationsPage,
});

function TutorNotificationsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 p-6 md:p-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          Notifications
        </h2>
        <p className="text-sm text-muted-foreground">
          Full notifications inbox — coming soon.
        </p>
      </div>
    </div>
  );
}
