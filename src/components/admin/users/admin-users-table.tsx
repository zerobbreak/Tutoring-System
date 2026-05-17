import { formatDistanceToNow, parseISO } from "date-fns";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Skeleton } from "#/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { formatApprovalStatus } from "#/lib/onboarding-documents";
import type { UserStatus } from "#/lib/user-status";
import { formatRoleLabel } from "#/lib/user-role";
import type { AdminUserRowDTO } from "#/server-actions/admin-users";

type AdminUsersTableProps = {
  booting: boolean;
  users: AdminUserRowDTO[];
  onSelectUser: (userId: string) => void;
};

function formatLastActive(iso: string | null): string {
  if (!iso) return "—";
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true });
  } catch {
    return "—";
  }
}

export function AdminUsersTable({
  booting,
  users,
  onSelectUser,
}: AdminUsersTableProps) {
  if (booting) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
        No users match this filter.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Institution</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead>Approval</TableHead>
            <TableHead>MFA</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>
                <div>
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </TableCell>
              <TableCell>{formatRoleLabel(user.role)}</TableCell>
              <TableCell>{user.institution_name ?? "—"}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatLastActive(user.last_login_at)}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    user.user_status === "ACTIVE"
                      ? "secondary"
                      : user.user_status === "REJECTED"
                        ? "destructive"
                        : user.user_status === "SUSPENDED"
                          ? "destructive"
                          : "outline"
                  }
                >
                  {formatApprovalStatus(
                    user.user_status as UserStatus,
                    user.onboarding_step,
                  )}
                </Badge>
              </TableCell>
              <TableCell>
                {user.mfa_enabled ? (
                  <Badge variant="secondary">On</Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">Off</span>
                )}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSelectUser(user.id)}
                >
                  Manage
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
