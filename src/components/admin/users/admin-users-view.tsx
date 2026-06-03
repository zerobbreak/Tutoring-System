import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { QueryErrorBanner } from "#/components/ui/query-fetch-feedback";
import { Button } from "#/components/ui/button";
import type { AdminUserCategory, AdminUserRowDTO } from "#/server-actions/admin-users";
import { AdminCreateUserDialog } from "./admin-create-user-dialog";
import { AdminUserDetailSheet } from "./admin-user-detail-sheet";
import { AdminUsersFilters } from "./admin-users-filters";
import { AdminUsersTable } from "./admin-users-table";

export type AdminUsersViewProps = {
  booting: boolean;
  loadError: string | null;
  onRetryLoad?: () => void;
  retryingLoad?: boolean;
  category: AdminUserCategory;
  search: string;
  users: AdminUserRowDTO[];
  selectedUserId: string | null;
  sheetOpen: boolean;
  onCategoryChange: (category: AdminUserCategory) => void;
  onSearchChange: (value: string) => void;
  onSelectUser: (userId: string) => void;
  onSheetOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};

export function AdminUsersView({
  booting,
  loadError,
  onRetryLoad,
  retryingLoad,
  category,
  search,
  users,
  selectedUserId,
  sheetOpen,
  onCategoryChange,
  onSearchChange,
  onSelectUser,
  onSheetOpenChange,
  onActionComplete,
}: AdminUsersViewProps) {
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="flex shrink-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Users className="size-7 text-(--lagoon-deep)" />
              User management
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Institution users, roles, onboarding approval, and module lecturers.
            </p>
          </div>
          <Button
            type="button"
            className="shrink-0 gap-2"
            onClick={() => setCreateOpen(true)}
          >
            <UserPlus className="size-4" />
            Add user
          </Button>
        </div>

        {loadError ? (
          <QueryErrorBanner
            message={loadError}
            onRetry={onRetryLoad}
            retrying={retryingLoad}
          />
        ) : null}

        <AdminUsersFilters
          category={category}
          search={search}
          onCategoryChange={onCategoryChange}
          onSearchChange={onSearchChange}
        />

        <AdminUsersTable
          booting={booting}
          users={users}
          onSelectUser={onSelectUser}
        />
      </div>

      <AdminUserDetailSheet
        userId={selectedUserId}
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        onActionComplete={onActionComplete}
      />

      <AdminCreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onComplete={onActionComplete}
      />
    </div>
  );
}
