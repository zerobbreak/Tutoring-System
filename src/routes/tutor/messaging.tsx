import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";

const messagingSearchSchema = z.object({
  lecturer: z.string().uuid().optional(),
});

export const Route = createFileRoute("/tutor/messaging")({
  validateSearch: messagingSearchSchema,
  component: TutorMessagingPage,
});

function TutorMessagingPage() {
  const { lecturer } = Route.useSearch();

  return (
    <div className="rise-in space-y-2">
      <p className="text-sm text-muted-foreground">
        Student and parent messaging will live here once connected to your inbox
        backend.
      </p>
      {lecturer ? (
        <p className="text-xs text-muted-foreground">
          Context: lecturer id <span className="font-mono">{lecturer}</span> (from
          sessions workspace).
        </p>
      ) : null}
    </div>
  );
}
