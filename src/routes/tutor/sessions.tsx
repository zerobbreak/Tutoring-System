import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tutor/sessions")({
  component: TutorSessionsPage,
})

function TutorSessionsPage() {
  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        View and manage your teaching sessions here. This section is ready for your session list and
        history.
      </p>
    </div>
  )
}
