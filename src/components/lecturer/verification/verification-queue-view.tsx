import { ClipboardCheck, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { VerificationClaimDetailSheet } from "./verification-claim-detail-sheet";
import { VerificationClaimsSection } from "./verification-claims-section";
import { VerificationQueueFilters } from "./verification-queue-filters";
import type { VerificationQueueViewProps } from "./types";

export function VerificationQueueView({
  booting,
  loadError,
  search,
  moduleId,
  modules,
  pending,
  disputed,
  recentlyVerified,
  selectedClaimId,
  sheetOpen,
  onSearchChange,
  onModuleChange,
  onReview,
  onSheetOpenChange,
  onActionComplete,
}: VerificationQueueViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-7 text-(--lagoon-deep)" />
            Verification queue
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verify tutor claims, attendance registers, and session validity
            for your modules.
          </p>
        </div>

        {loadError ? (
          <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>Search & filter claims</CardTitle>
            <CardDescription>
              Filter by module or search tutor name and module code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VerificationQueueFilters
              search={search}
              moduleId={moduleId}
              modules={modules}
              onSearchChange={onSearchChange}
              onModuleChange={onModuleChange}
            />
          </CardContent>
        </Card>

        {booting ? (
          <div className="flex flex-1 justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid min-h-[min(70vh,720px)] flex-1 grid-cols-1 gap-4 lg:grid-cols-3 lg:items-stretch">
            <VerificationClaimsSection
              title="Pending"
              description="Awaiting your review"
              claims={pending}
              countLabel={`${pending.length} awaiting`}
              emptyMessage="No claims awaiting verification."
              onReview={onReview}
            />
            <VerificationClaimsSection
              title="Disputed"
              description="Attendance or hours under dispute"
              claims={disputed}
              countLabel={`${disputed.length} open`}
              emptyMessage="No disputed claims."
              onReview={onReview}
            />
            <VerificationClaimsSection
              title="Recently verified"
              description="Approved or verified sessions"
              claims={recentlyVerified}
              countLabel={`${recentlyVerified.length} recent`}
              emptyMessage="No recently verified claims."
              onReview={onReview}
            />
          </div>
        )}

        <VerificationClaimDetailSheet
          claimId={selectedClaimId}
          open={sheetOpen}
          onOpenChange={onSheetOpenChange}
          onActionComplete={onActionComplete}
        />
      </div>
    </div>
  );
}
