import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Skeleton } from "#/components/ui/skeleton";

type AdminKpiCardsProps = {
  booting: boolean;
  pendingApprovalsCount: number;
  verifiedClaimsCount: number;
  activeSessionsCount: number;
  approvedHours: number;
  weekStart: string;
  weekEnd: string;
};

export function AdminKpiCards({
  booting,
  pendingApprovalsCount,
  verifiedClaimsCount,
  activeSessionsCount,
  approvedHours,
  weekStart,
  weekEnd,
}: AdminKpiCardsProps) {
  const kpiItems = [
    {
      label: "Pending Approvals",
      value: booting ? null : pendingApprovalsCount,
      sub: "Awaiting lecturer verification",
      icon: ClipboardList,
      muted: false,
    },
    {
      label: "Verified Claims",
      value: booting ? null : verifiedClaimsCount,
      sub: "Verified and approved",
      icon: CheckCircle2,
      muted: false,
    },
    {
      label: "Active Sessions",
      value: booting ? null : activeSessionsCount,
      sub: `${weekStart} — ${weekEnd}`,
      icon: Calendar,
      muted: false,
    },
    {
      label: "Payroll Ready",
      value: booting ? null : "Soon",
      sub: `${approvedHours} hrs approved · export coming soon`,
      icon: Wallet,
      muted: true,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {kpiItems.map((item) => (
        <Card key={item.label} className={item.muted ? "opacity-90" : undefined}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <item.icon className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {item.value === null ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p
                className={`text-2xl font-bold ${item.muted ? "text-muted-foreground" : ""}`}
              >
                {item.value}
              </p>
            )}
            <p className="text-xs text-muted-foreground">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
