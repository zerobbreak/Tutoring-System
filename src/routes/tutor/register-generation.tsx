import { createFileRoute } from "@tanstack/react-router";
import { TutorRegisterGenerationPage } from "#/components/tutor/register-generation/tutor-register-generation-page";

export const Route = createFileRoute("/tutor/register-generation")({
  component: TutorRegisterGenerationPage,
});
