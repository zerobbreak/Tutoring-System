import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import * as z from "zod";
import { AdminUsersView } from "#/components/admin/users/admin-users-view";
import { useAdminUsersData } from "#/components/admin/users/use-admin-users-data";
import { useSessionUser } from "#/lib/use-session-user";
import type { AdminUserCategory } from "#/server-actions/admin-users";

const usersSearchSchema = z.object({
  user: z.string().uuid().optional(),
});

export const Route = createFileRoute("/admin/users")({
  validateSearch: usersSearchSchema,
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const { user, pending } = useSessionUser();
  const urlSearch = Route.useSearch();
  const navigate = Route.useNavigate();

  const [category, setCategory] = useState<AdminUserCategory>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const { users, isLoading, error, invalidate } = useAdminUsersData({
    enabled: !!user,
    category,
    debouncedSearch,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (urlSearch.user) {
      setSelectedUserId(urlSearch.user);
      setSheetOpen(true);
    }
  }, [urlSearch.user]);

  const openUser = (userId: string) => {
    setSelectedUserId(userId);
    setSheetOpen(true);
    void navigate({
      to: "/admin/users",
      search: { user: userId },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    setSheetOpen(open);
    if (!open) {
      setSelectedUserId(null);
      void navigate({
        to: "/admin/users",
        search: { user: undefined },
        replace: true,
      });
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
    <AdminUsersView
      booting={isLoading}
      loadError={error instanceof Error ? error.message : null}
      category={category}
      search={search}
      users={users}
      selectedUserId={selectedUserId}
      sheetOpen={sheetOpen}
      onCategoryChange={setCategory}
      onSearchChange={setSearch}
      onSelectUser={openUser}
      onSheetOpenChange={handleSheetOpenChange}
      onActionComplete={() => {
        void invalidate();
      }}
    />
  );
}
