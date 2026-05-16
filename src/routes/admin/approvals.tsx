import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import * as z from "zod";
import { AdminApprovalsView } from "#/components/admin/approvals/admin-approvals-view";
import {
  listApprovalsQueueFn,
  type AdminApprovalClaimCardDTO,
  type VerificationModuleOptionDTO,
} from "#/server-actions/admin-approvals";

const rootRouteApi = getRouteApi("__root__");

const approvalsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/approvals")({
  validateSearch: approvalsSearchSchema,
  component: AdminApprovalsPage,
});

function AdminApprovalsPage() {
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
  const [awaitingAdmin, setAwaitingAdmin] = useState<AdminApprovalClaimCardDTO[]>(
    [],
  );
  const [disputed, setDisputed] = useState<AdminApprovalClaimCardDTO[]>([]);
  const [recentlyApproved, setRecentlyApproved] = useState<
    AdminApprovalClaimCardDTO[]
  >([]);
  const [escalated, setEscalated] = useState<AdminApprovalClaimCardDTO[]>([]);
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
      const result = await listApprovalsQueueFn({
        data: {
          search: debouncedSearch || undefined,
          moduleId: moduleId || undefined,
        },
      });
      setModules(result.modules);
      setAwaitingAdmin(result.awaitingAdmin);
      setDisputed(result.disputed);
      setRecentlyApproved(result.recentlyApproved);
      setEscalated(result.escalated);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load approvals queue",
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
      to: "/admin/approvals",
      search: { claim: claimId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedClaimId(null);
      void navigate({
        to: "/admin/approvals",
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
    <AdminApprovalsView
      booting={booting}
      loadError={loadError}
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
      onActionComplete={() => void loadQueue()}
    />
  );
}
