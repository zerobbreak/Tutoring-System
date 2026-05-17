import { createFileRoute } from "@tanstack/react-router";
import { ClaimDetailsView } from "#/components/tutor/claims/claim-details-view";

export const Route = createFileRoute("/tutor/claims/$claimId")({
  component: TutorClaimDetailsRoute,
});

function TutorClaimDetailsRoute() {
  const { claimId } = Route.useParams();
  return <ClaimDetailsView claimId={claimId} />;
}
