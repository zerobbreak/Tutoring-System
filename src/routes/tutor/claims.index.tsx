import { createFileRoute } from "@tanstack/react-router";
import { ClaimsDashboard } from "#/components/tutor/claims/claims-dashboard";

export const Route = createFileRoute("/tutor/claims/")({
  component: ClaimsDashboard,
});
