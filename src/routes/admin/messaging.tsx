import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";
import { AdminMessagingView } from "#/components/admin/messaging/admin-messaging-view";

const messagingSearchSchema = z.object({
  conversation: z.string().uuid().optional(),
  dispute: z.string().uuid().optional(),
  compose: z.enum(["notice", "broadcast"]).optional(),
});

export const Route = createFileRoute("/admin/messaging")({
  validateSearch: messagingSearchSchema,
  component: AdminMessagingPage,
});

function AdminMessagingPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return <AdminMessagingView search={search} navigate={navigate} />;
}
