import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tutor/messaging")({
  component: TutorMessagingPage,
})

function TutorMessagingPage() {
  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        Student and parent messaging will live here once connected to your inbox backend.
      </p>
    </div>
  )
}
