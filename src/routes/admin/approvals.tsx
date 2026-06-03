import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { AdminApprovalsView } from "#/components/admin/approvals/admin-approvals-view";
import { useAdminApprovalsData } from "#/components/admin/approvals/use-admin-approvals-data";
import { APP_PATHS } from "#/lib/app-paths";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { useSessionUser } from "#/lib/use-session-user";

const approvalsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/approvals")({
  validateSearch: approvalsSearchSchema,
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
  const { user, pending } = useSessionUser();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    modules,
    awaitingAdmin,
    disputed,
    recentlyApproved,
    escalated,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useAdminApprovalsData({
    enabled: !!user,
    debouncedSearch,
    moduleId,
  });
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (urlSearch.claim) {
      setSelectedClaimId(urlSearch.claim);
      setSheetOpen(true);
    }
  }, [urlSearch.claim]);

  const openReview = (claimId: string) => {
    setSelectedClaimId(claimId);
    setSheetOpen(true);
    void navigate({
      to: APP_PATHS.admin.approvals,
      search: { claim: claimId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedClaimId(null);
      void navigate({
        to: APP_PATHS.admin.approvals,
        search: { claim: undefined },
        replace: true,
      });
    }
  };

  return (
    <QueryPageGate
      sessionPending={pending || !user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading approvals…"
    >
    <AdminApprovalsView
      booting={isLoading}
      {...feedback}
      search={search}
      moduleId={moduleId}
      modules={modules}
      awaitingAdmin={awaitingAdmin}
      disputed={disputed}
      recentlyApproved={recentlyApproved}
      escalated={escalated}
      selectedClaimId={selectedClaimId}
      sheetOpen={sheetOpen}
      onSearchChange={setSearch}
      onModuleChange={setModuleId}
      onReview={openReview}
      onSheetOpenChange={handleSheetOpenChange}
      onActionComplete={invalidate}
    />
    </QueryPageGate>
  );
}
