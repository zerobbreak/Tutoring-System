import { createFileRoute } from "@tanstack/react-router";
import { TutorEarningsView } from "#/components/tutor/earnings/tutor-earnings-view";

export const Route = createFileRoute("/tutor/earnings")({
  component: TutorEarningsPage,
});

function TutorEarningsPage() {
  return <TutorEarningsView />;
}
