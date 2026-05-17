import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import * as z from "zod";
import { AdminUsersView } from "#/components/admin/users/admin-users-view";
import { useSessionUser } from "#/lib/use-session-user";
import {
  listAdminUsersFn,
  type AdminUserCategory,
  type AdminUserRowDTO,
} from "#/server-actions/admin-users";

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

  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [category, setCategory] = useState<AdminUserCategory>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRowDTO[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadUsers = useCallback(async () => {
    if (!user) return;
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listAdminUsersFn({
        data: {
          category,
          search: debouncedSearch || undefined,
        },
      });
      setUsers(result.users);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load users",
      );
    } finally {
      setBooting(false);
    }
  }, [user, category, debouncedSearch]);

  useEffect(() => {
    if (!user) {
      setBooting(false);
      return;
    }
    void loadUsers();
  }, [user?.id, loadUsers]);

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
      booting={booting}
      loadError={loadError}
      category={category}
      search={search}
      users={users}
      selectedUserId={selectedUserId}
      sheetOpen={sheetOpen}
      onCategoryChange={setCategory}
      onSearchChange={setSearch}
      onSelectUser={openUser}
      onSheetOpenChange={handleSheetOpenChange}
      onActionComplete={() => void loadUsers()}
    />
  );
}
