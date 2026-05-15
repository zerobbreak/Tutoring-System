import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { listTutorSessionClaimsFn, type TutorSessionClaimDTO } from "#/server-actions/tutor-sessions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Badge } from "#/components/ui/badge";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileEdit,
  History,
  Info,
  Loader2,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { format, parseISO } from "date-fns";
import { toast } from "#/lib/toast";

export function ClaimsDashboard() {
  const [claims, setClaims] = useState<TutorSessionClaimDTO[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await listTutorSessionClaimsFn();
      setClaims(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load claims");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-lagoon" />
        <p className="text-muted-foreground animate-pulse">Loading claims dashboard...</p>
      </div>
    );
  }


  const grouped = {
    DRAFT: (claims || []).filter((c) => c.status === "DRAFT"),
    PENDING: (claims || []).filter((c) => c.status === "PENDING_VERIFICATION"),
    DISPUTED: (claims || []).filter((c) => c.status === "DISPUTED"),
    APPROVED: (claims || []).filter(
      (c) => c.status === "APPROVED" || c.status === "VERIFIED",
    ),
  };

  const stats = [
    {
      label: "Drafts",
      count: grouped.DRAFT.length,
      icon: FileEdit,
      color: "text-slate-500",
      bg: "bg-slate-100",
    },
    {
      label: "Pending",
      count: grouped.PENDING.length,
      icon: Clock,
      color: "text-amber-500",
      bg: "bg-amber-100",
    },
    {
      label: "Disputed",
      count: grouped.DISPUTED.length,
      icon: AlertCircle,
      color: "text-destructive",
      bg: "bg-red-100",
    },
    {
      label: "Approved",
      count: grouped.APPROVED.length,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-100",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "DRAFT":
        return (
          <Badge variant="secondary" className="bg-slate-100 text-slate-700">
            Draft
          </Badge>
        );
      case "PENDING_VERIFICATION":
        return (
          <Badge
            variant="outline"
            className="border-amber-200 bg-amber-50 text-amber-700"
          >
            Pending
          </Badge>
        );
      case "DISPUTED":
        return (
          <Badge variant="destructive" className="bg-red-100 text-red-700">
            Disputed
          </Badge>
        );
      case "VERIFIED":
        return (
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            Verified
          </Badge>
        );
      case "APPROVED":
        return (
          <Badge className="bg-emerald-500 text-white hover:bg-emerald-600">
            Approved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="p-6 space-y-6 w-full flex-1 flex flex-col min-h-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Claims Dashboard</h1>
          <p className="text-muted-foreground text-lg">
            Track your hour verification workflow and lecturer approvals.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/tutor/sessions">
            <History className="mr-2 h-4 w-4" />
            Session History
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </CardTitle>
              <div className={`p-2 rounded-full ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.count}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-white/50 backdrop-blur-sm flex-1 flex flex-col min-h-0">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Verification Claims</CardTitle>
              <CardDescription>
                Detailed list of your submitted and upcoming claims.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3" />
              <span>Click on a row to see history and evidence</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto min-h-0">
          <Table>
            <TableHeader className="bg-slate-50/30">
              <TableRow>
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-center">Evidence</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims?.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 text-center text-muted-foreground"
                  >
                    No claims found.
                  </TableCell>
                </TableRow>
              ) : (
                claims?.map((claim) => (
                  <TableRow key={claim.id} className="group cursor-pointer hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-medium">
                      {format(parseISO(claim.session_date), "MMM d")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{claim.module?.code}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {claim.module?.name}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-slate-500">
                      {claim.session_kind || "Manual"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {claim.hours.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      {claim.evidenceCount > 0 ? (
                        <div className="flex items-center justify-center gap-1 text-xs text-emerald-600 bg-emerald-50 rounded-full px-2 py-0.5 mx-auto w-fit">
                          <CheckCircle2 className="h-3 w-3" />
                          {claim.evidenceCount}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell>{getStatusBadge(claim.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link to="/tutor/claims/$claimId" params={{ claimId: claim.id }}>
                          View
                          <ArrowRight className="ml-2 h-3 w-3" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
