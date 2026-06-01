import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { VerificationQueueView } from "#/components/lecturer/verification/verification-queue-view";
import { useVerificationQueueData } from "#/components/lecturer/verification/use-verification-queue-data";

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
    error,
    invalidate,
  } = useVerificationQueueData({
    enabled: !!user,
    debouncedSearch,
    moduleId,
  });

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
      to: "/lecturer/verification-queue",
      search: { claim: claimId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedClaimId(null);
      void navigate({
        to: "/lecturer/verification-queue",
        search: { claim: undefined },
        replace: true,
      });
    }
  };

  if (!user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <VerificationQueueView
      booting={isLoading}
      loadError={error instanceof Error ? error.message : null}
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
  );
}
