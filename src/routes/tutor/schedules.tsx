import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tutor/schedules")({
  component: TutorSchedulesPage,
})

function TutorSchedulesPage() {
  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        Calendars, availability blocks, and recurring slots can be wired into this schedules view.
      </p>
    </div>
  )
}
