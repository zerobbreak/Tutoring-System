import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  KeyRound,
  Shield,
  UserCog,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { cn } from "#/lib/utils";
import { formatApprovalStatus } from "#/lib/onboarding-documents";
import { formatRoleLabel } from "#/lib/user-role";
import type { AdminUserRowDTO } from "#/server-actions/admin-users";

export const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100] max-h-60",
};

type DetailSectionProps = {
  title: string;
  description?: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
};

export function DetailSection({
  title,
  description,
  icon: Icon,
  children,
  className,
}: DetailSectionProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border/80 bg-card p-4 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--lagoon-deep)/10">
          <Icon className="size-4 text-(--lagoon-deep)" aria-hidden />
        </span>
        <div className="min-w-0 pt-0.5">
          <h3 className="text-sm font-semibold leading-none">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

type StatItemProps = {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
};

export function StatItem({ label, value, icon: Icon }: StatItemProps) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className="mt-0.5 truncate text-sm font-medium text-foreground">
        {value}
      </dd>
    </div>
  );
}

type UserDetailHeroProps = {
  user: AdminUserRowDTO;
};

export function UserDetailHero({ user }: UserDetailHeroProps) {
  const joinedLabel = user.created_at
    ? format(parseISO(user.created_at), "PP")
    : "—";
  const lastActiveLabel = user.last_login_at
    ? formatDistanceToNow(parseISO(user.last_login_at), { addSuffix: true })
    : "Never";

  return (
    <div className="shrink-0 border-b bg-linear-to-br from-(--lagoon-deep)/10 via-background to-background px-6 py-5">
      <div className="flex items-start gap-4">
        <Avatar className="size-14 ring-2 ring-(--lagoon-deep)/15">
          <AvatarFallback className="text-lg">
            {getInitials(user.full_name) || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="truncate text-lg font-semibold tracking-tight">
            {user.full_name}
          </h2>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge className="bg-(--lagoon-deep) text-white hover:bg-(--lagoon-deep)">
              {formatRoleLabel(user.role)}
            </Badge>
            <Badge
              variant="outline"
              className={statusBadgeClass(user.user_status)}
            >
              {formatApprovalStatus(user.user_status, user.onboarding_step)}
            </Badge>
            {user.user_status === "SUSPENDED" || user.user_status === "REJECTED" ? (
              <Badge variant="destructive">Disabled</Badge>
            ) : null}
          </div>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <StatItem label="Joined" value={joinedLabel} icon={Calendar} />
        <StatItem label="Last active" value={lastActiveLabel} icon={UserCog} />
        <StatItem
          label="MFA"
          value={
            user.mfa_enabled ? (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <CheckCircle2 className="size-3.5" />
                Enabled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <XCircle className="size-3.5" />
                Off
              </span>
            )
          }
          icon={KeyRound}
        />
        {user.institution_name ? (
          <div className="col-span-2 sm:col-span-3">
            <StatItem
              label="Institution"
              value={user.institution_name}
              icon={Shield}
            />
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";
    case "REJECTED":
    case "SUSPENDED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "PENDING_APPROVAL":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "";
  }
}
