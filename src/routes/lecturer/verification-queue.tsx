import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import * as z from "zod";
import { VerificationQueueView } from "#/components/lecturer/verification/verification-queue-view";
import {
  listVerificationQueueFn,
  type VerificationClaimCardDTO,
  type VerificationModuleOptionDTO,
} from "#/server-actions/lecturer-verification";

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

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [modules, setModules] = useState<VerificationModuleOptionDTO[]>([]);
  const [pending, setPending] = useState<VerificationClaimCardDTO[]>([]);
  const [disputed, setDisputed] = useState<VerificationClaimCardDTO[]>([]);
  const [recentlyVerified, setRecentlyVerified] = useState<
    VerificationClaimCardDTO[]
  >([]);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadQueue = useCallback(async () => {
    if (!user) return;
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listVerificationQueueFn({
        data: {
          search: debouncedSearch || undefined,
          moduleId: moduleId || undefined,
        },
      });
      setModules(result.modules);
      setPending(result.pending);
      setDisputed(result.disputed);
      setRecentlyVerified(result.recentlyVerified);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load verification queue",
      );
    } finally {
      setBooting(false);
    }
  }, [user, debouncedSearch, moduleId]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void loadQueue();
  }, [user?.id, loadQueue]);

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

  const handleActionComplete = () => {
    void loadQueue();
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
      booting={booting}
      loadError={loadError}
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
      onActionComplete={handleActionComplete}
    />
  );
}
