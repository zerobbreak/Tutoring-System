import { createFileRoute } from "@tanstack/react-router";
import { TutorSchedulesPage } from "#/components/tutor/schedules/tutor-schedules-page";

export const Route = createFileRoute("/tutor/schedules")({
  component: TutorSchedulesPage,
});
