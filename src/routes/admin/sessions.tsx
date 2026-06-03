import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { AdminSessionsView } from "#/components/admin/sessions/admin-sessions-view";
import { useAdminSessionsData } from "#/components/admin/sessions/use-admin-sessions-data";
import { APP_PATHS } from "#/lib/app-paths";
import { QueryPageGate } from "#/lib/query-page-gate";
import { queryLoadFeedbackProps } from "#/lib/query-route-props";
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

  const {
    data,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
    invalidate,
  } = useAdminSessionsData({
    enabled: !!user,
    lookbackDays,
    moduleId,
    tutorId,
    lecturerId,
  });
  const feedback = queryLoadFeedbackProps({ error, isFetching, refetch });

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
        to: APP_PATHS.admin.sessions,
        search: { claim: undefined },
        replace: true,
      });
    } else {
      setSheetOpen(true);
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
      loadingLabel="Loading sessions…"
    >
    <AdminSessionsView
      booting={isLoading}
      {...feedback}
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
    </QueryPageGate>
  );
}
