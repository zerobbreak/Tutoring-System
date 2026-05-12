import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tutor/notes")({
  component: TutorNotesPage,
})

function TutorNotesPage() {
  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        Session notes, learning objectives, and shared materials can be organized in this area.
      </p>
    </div>
  )
}
