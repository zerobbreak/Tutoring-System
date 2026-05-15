import { createFileRoute } from "@tanstack/react-router";
import { LecturerPlaceholderPage } from "#/components/lecturer/lecturer-placeholder-page";

export const Route = createFileRoute("/lecturer/verification-queue")({
  component: VerificationQueuePage,
});

function VerificationQueuePage() {
  return <LecturerPlaceholderPage title="Verification Queue" />;
}
