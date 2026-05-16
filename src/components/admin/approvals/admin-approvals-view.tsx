import { ClipboardCheck, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import type {
  AdminApprovalClaimCardDTO,
  VerificationModuleOptionDTO,
} from "#/server-actions/admin-approvals";
import { AdminApprovalDetailSheet } from "./admin-approval-detail-sheet";
import { AdminApprovalsClaimsSection } from "./admin-approvals-claims-section";
import { AdminApprovalsFilters } from "./admin-approvals-filters";
import { AdminPayrollExportBar } from "./admin-payroll-export-bar";

export type AdminApprovalsViewProps = {
  booting: boolean;
  loadError: string | null;
  search: string;
  moduleId: string;
  modules: VerificationModuleOptionDTO[];
  awaitingAdmin: AdminApprovalClaimCardDTO[];
  disputed: AdminApprovalClaimCardDTO[];
  recentlyApproved: AdminApprovalClaimCardDTO[];
  escalated: AdminApprovalClaimCardDTO[];
  selectedClaimId: string | null;
  sheetOpen: boolean;
  onSearchChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onReview: (claimId: string) => void;
  onSheetOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};

export function AdminApprovalsView({
  booting,
  loadError,
  search,
  moduleId,
  modules,
  awaitingAdmin,
  disputed,
  recentlyApproved,
  escalated,
  selectedClaimId,
  sheetOpen,
  onSearchChange,
  onModuleChange,
  onReview,
  onSheetOpenChange,
  onActionComplete,
}: AdminApprovalsViewProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="shrink-0">
          <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <ClipboardCheck className="size-7 text-(--lagoon-deep)" />
            Institutional verification
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Centralized approval management for lecturer-verified tutor claims
            across your institution.
          </p>
        </div>

        {loadError ? (
          <div className="shrink-0 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        <AdminPayrollExportBar onExported={onActionComplete} />

        <Card className="shrink-0">
          <CardHeader>
            <CardTitle>Search & filter</CardTitle>
            <CardDescription>
              Filter by module or search tutor name and module code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminApprovalsFilters
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
          <div className="grid min-h-[min(70vh,720px)] flex-1 grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-4 2xl:items-stretch">
            <AdminApprovalsClaimsSection
              title="Pending approvals"
              description="Lecturer verified — awaiting admin"
              claims={awaitingAdmin}
              countLabel={`${awaitingAdmin.length} awaiting`}
              emptyMessage="No claims awaiting admin approval."
              onReview={onReview}
            />
            <AdminApprovalsClaimsSection
              title="Disputed claims"
              description="Attendance or hour disputes"
              claims={disputed}
              countLabel={`${disputed.length} disputed`}
              emptyMessage="No open disputes."
              onReview={onReview}
            />
            <AdminApprovalsClaimsSection
              title="Escalated claims"
              description="Stalled, frozen, or high priority"
              claims={escalated}
              countLabel={`${escalated.length} escalated`}
              emptyMessage="No escalated items."
              onReview={onReview}
            />
            <AdminApprovalsClaimsSection
              title="Recently approved"
              description="Finalized for payroll"
              claims={recentlyApproved}
              countLabel={`${recentlyApproved.length} recent`}
              emptyMessage="No recently approved claims."
              onReview={onReview}
            />
          </div>
        )}
      </div>

      <AdminApprovalDetailSheet
        claimId={selectedClaimId}
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        onActionComplete={onActionComplete}
      />
    </div>
  );
}
