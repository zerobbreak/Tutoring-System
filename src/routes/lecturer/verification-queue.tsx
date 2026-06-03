import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { VerificationQueueView } from "#/components/lecturer/verification/verification-queue-view";
import { useVerificationQueueData } from "#/components/lecturer/verification/use-verification-queue-data";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
import { APP_PATHS } from "#/lib/app-paths";

const rootRouteApi = getRouteApi("__root__");

const verificationSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/lecturer/verification-queue")({
  validateSearch: verificationSearchSchema,
  component: VerificationQueuePage,
});

function VerificationQueuePage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const {
    modules,
    pending,
    disputed,
    recentlyVerified,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useVerificationQueueData({
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
      to: APP_PATHS.lecturer.verificationQueue,
      search: { claim: claimId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedClaimId(null);
      void navigate({
        to: APP_PATHS.lecturer.verificationQueue,
        search: { claim: undefined },
        replace: true,
      });
    }
  };

  return (
    <QueryPageGate
      sessionPending={!user}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      hasData={isSuccess}
      onRetry={() => void refetch()}
      loadingLabel="Loading verification queue…"
    >
    <VerificationQueueView
      booting={isLoading}
      {...feedback}
      search={search}
      moduleId={moduleId}
      modules={modules}
      pending={pending}
      disputed={disputed}
      recentlyVerified={recentlyVerified}
      selectedClaimId={selectedClaimId}
      sheetOpen={sheetOpen}
      onSearchChange={setSearch}
      onModuleChange={setModuleId}
      onReview={openReview}
      onSheetOpenChange={handleSheetOpenChange}
      onActionComplete={() => {
        void invalidate();
      }}
    />
    </QueryPageGate>
  );
}
