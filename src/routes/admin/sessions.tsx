import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { AdminSessionsView } from "#/components/admin/sessions/admin-sessions-view";
import { useAdminSessionsData } from "#/components/admin/sessions/use-admin-sessions-data";
import { useSessionUser } from "#/lib/use-session-user";

const sessionsSearchSchema = z.object({
  claim: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/sessions")({
  validateSearch: sessionsSearchSchema,
  component: AdminSessionsPage,
});

function AdminSessionsPage() {
  const { user, pending } = useSessionUser();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const [lookbackDays, setLookbackDays] = useState(30);
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [lecturerId, setLecturerId] = useState<string | null>(null);
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data, isLoading, error, invalidate } = useAdminSessionsData({
    enabled: !!user,
    lookbackDays,
    moduleId,
    tutorId,
    lecturerId,
  });

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

  if (pending || !user) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <AdminSessionsView
      booting={isLoading}
      loadError={error instanceof Error ? error.message : null}
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
      onTutorSessionApproved={() => {
        void invalidate();
      }}
    />
  );
}
