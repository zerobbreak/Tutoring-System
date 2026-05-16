import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import * as z from "zod";
import { AdminSessionsView } from "#/components/admin/sessions/admin-sessions-view";
import {
  listAdminSessionsFn,
  type AdminSessionsPageDataDTO,
} from "#/server-actions/admin-sessions";

const rootRouteApi = getRouteApi("__root__");

const sessionsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/sessions")({
  validateSearch: sessionsSearchSchema,
  component: AdminSessionsPage,
});

function AdminSessionsPage() {
  const { sessionData } = rootRouteApi.useLoaderData();
  const user = sessionData?.user;
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<AdminSessionsPageDataDTO | null>(null);
  const [lookbackDays, setLookbackDays] = useState(30);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [lecturerId, setLecturerId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listAdminSessionsFn({
        data: {
          lookbackDays,
          moduleId: moduleId ?? undefined,
          tutorId: tutorId ?? undefined,
          lecturerId: lecturerId ?? undefined,
        },
      });
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load sessions",
      );
    } finally {
      setBooting(false);
    }
  }, [user, lookbackDays, moduleId, tutorId, lecturerId]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void load();
  }, [user?.id, load]);

  useEffect(() => {
    if (urlSearch.claim) {
      setSelectedClaimId(urlSearch.claim);
      setSheetOpen(true);
    }
  }, [urlSearch.claim]);

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSheetOpen(false);
      setSelectedClaimId(null);
      void navigate({
        to: "/admin/sessions",
        search: { claim: undefined },
        replace: true,
      });
    } else {
      setSheetOpen(true);
    }
  };

  if (!user) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Sign in as an admin to view sessions.
      </p>
    );
  }

  return (
    <AdminSessionsView
      booting={booting}
      loadError={loadError}
      data={data}
      lookbackDays={lookbackDays}
      moduleId={moduleId}
      tutorId={tutorId}
      lecturerId={lecturerId}
      selectedClaimId={selectedClaimId ?? urlSearch.claim ?? null}
      sheetOpen={sheetOpen}
      onLookbackChange={setLookbackDays}
      onModuleChange={setModuleId}
      onTutorChange={setTutorId}
      onLecturerChange={setLecturerId}
      navigate={navigate}
      onSheetOpenChange={handleSheetOpenChange}
    />
  );
}
