import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/tutor/register-generation")({
  component: TutorRegisterGenerationPage,
})

function TutorRegisterGenerationPage() {
  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        Generate attendance registers, sign-in sheets, or compliance exports from your session data.
      </p>
    </div>
  )
}
