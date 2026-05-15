import { Badge } from "#/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type { VerificationClaimCardDTO } from "#/server-actions/lecturer-verification";
import { VerificationClaimCard } from "./verification-claim-card";

type VerificationClaimsSectionProps = {
  title: string;
  description: string;
  claims: VerificationClaimCardDTO[];
  emptyMessage: string;
  countLabel?: string;
  onReview: (claimId: string) => void;
};

export function VerificationClaimsSection({
  title,
  description,
  claims,
  emptyMessage,
  countLabel,
  onReview,
}: VerificationClaimsSectionProps) {
  return (
    <Card className="flex min-h-0 flex-col lg:min-h-[calc(100vh-16rem)]">
      <CardHeader className="shrink-0 space-y-1 pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <Badge variant="secondary" className="shrink-0">
            {countLabel ?? claims.length}
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto overscroll-contain pt-0">
        {claims.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <div className="flex flex-col gap-3 pb-1">
            {claims.map((claim) => (
              <VerificationClaimCard
                key={claim.id}
                claim={claim}
                onReview={onReview}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
