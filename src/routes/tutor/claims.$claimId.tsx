import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  getClaimDetailsFn,
  type ClaimDetailsDTO,
} from "#/server-actions/tutor-sessions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Badge } from "#/components/ui/badge";
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  History as HistoryIcon,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  Send,
  FileSearch,
  Loader2,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { format, parseISO } from "date-fns";
import { toast } from "#/lib/toast";

export const Route = createFileRoute("/tutor/claims/$claimId")({
  component: ClaimDetailsView,
});

function ClaimDetailsView() {
  const { claimId } = Route.useParams();
  const [claim, setClaim] = useState<ClaimDetailsDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClaimDetailsFn({ data: { claimId } });
      setClaim(data);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load claim details",
      );
    } finally {
      setIsLoading(false);
    }
  }, [claimId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-lagoon" />
        <p className="text-muted-foreground animate-pulse">
          Loading claim details...
        </p>
      </div>
    );
  }

  if (!claim) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto mt-20">
        <div className="bg-red-50 text-red-600 p-4 rounded-full w-fit mx-auto">
          <AlertCircle className="h-12 w-12" />
        </div>
        <h2 className="text-2xl font-bold">Claim not found</h2>
        <p className="text-muted-foreground">
          The claim you are looking for might have been deleted or you don't
          have access to it.
        </p>
        <Button asChild>
          <Link to="/tutor/claims">Back to Claims</Link>
        </Button>
      </div>
    );
  }

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "DRAFT":
        return {
          label: "Draft",
          color: "bg-slate-100 text-slate-700",
          icon: FileText,
        };
      case "PENDING_VERIFICATION":
        return {
          label: "Pending Verification",
          color: "bg-amber-100 text-amber-700",
          icon: Clock3,
        };
      case "DISPUTED":
        return {
          label: "Disputed",
          color: "bg-red-100 text-red-700",
          icon: AlertCircle,
        };
      case "VERIFIED":
        return {
          label: "Verified",
          color: "bg-emerald-50 text-emerald-700 border-emerald-200 border",
          icon: CheckCircle2,
        };
      case "APPROVED":
        return {
          label: "Approved",
          color: "bg-emerald-500 text-white",
          icon: CheckCircle2,
        };
      default:
        return {
          label: status,
          color: "bg-slate-100 text-slate-700",
          icon: Info,
        };
    }
  };

  const statusConfig = getStatusConfig(claim.status);

  return (
    <div className="p-6 space-y-6 w-full flex-1 min-h-0">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/tutor/claims">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Claim Details</h1>
            <Badge
              className={`${statusConfig.color} px-3 py-1 text-sm font-medium`}
            >
              <statusConfig.icon className="mr-1.5 h-3.5 w-3.5" />
              {statusConfig.label}
            </Badge>
          </div>
          <p className="text-muted-foreground flex items-center gap-2">
            ID: <span className="font-mono text-xs">{claim.id}</span>
          </p>
        </div>
        <div className="flex gap-2">
          {claim.status === "DRAFT" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Send className="mr-2 h-4 w-4" />
              Submit for Verification
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 flex-1 min-h-0">
        {/* Left Column: Info & Evidence */}
        <div className="md:col-span-2 space-y-6">
          <Card className="border-none shadow-sm bg-linear-to-br from-white to-slate-50/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-indigo-500" />
                Session Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-indigo-50 p-2 rounded-lg">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Date & Time
                    </p>
                    <p className="font-semibold">
                      {format(
                        parseISO(claim.session_date),
                        "EEEE, MMMM d, yyyy",
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {claim.start_time?.slice(0, 5)} -{" "}
                      {claim.end_time?.slice(0, 5)} ({claim.hours} hrs)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-amber-50 p-2 rounded-lg">
                    <User className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Module & Lecturer
                    </p>
                    <p className="font-semibold">
                      {claim.module?.code}: {claim.module?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Lecturer:{" "}
                      {claim.module?.lecturer?.full_name || "Unassigned"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-emerald-50 p-2 rounded-lg">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Topics & Notes
                    </p>
                    <p className="text-sm">
                      {claim.topics_covered || "No topics specified"}
                    </p>
                    {claim.notes && (
                      <div className="mt-2 p-2 bg-white rounded border text-xs text-muted-foreground italic">
                        "{claim.notes}"
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="mt-1 bg-slate-100 p-2 rounded-lg">
                    <FileSearch className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      Attendance
                    </p>
                    <p className="font-semibold">
                      {claim.attendance_present_count || 0} /{" "}
                      {claim.attendance_expected_count || 0} present
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Source: {claim.session_kind || "manual"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="h-5 w-5 text-emerald-500" />
                  Attendance Evidence
                </CardTitle>
                <CardDescription>
                  Documents uploaded to support this claim.
                </CardDescription>
              </div>
              <Badge variant="outline">{claim.evidence.length} Files</Badge>
            </CardHeader>
            <CardContent>
              {claim.evidence.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-slate-50/50">
                  <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">No evidence uploaded yet.</p>
                  {claim.status === "DRAFT" && (
                    <Button variant="outline" size="sm" className="mt-4">
                      Upload Evidence
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                  {claim.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center justify-between p-4 rounded-xl border bg-white hover:border-emerald-200 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="p-2 bg-emerald-50 rounded-lg shrink-0">
                          <FileText className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div className="overflow-hidden">
                          <p
                            className="text-sm font-medium truncate max-w-[150px]"
                            title={ev.file_name}
                          >
                            {ev.file_name}
                          </p>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tight">
                            {format(parseISO(ev.uploaded_at), "MMM d, HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          asChild
                        >
                          <a
                            href={ev.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Workflow Timeline */}
        <div className="space-y-6">
          <Card className="border-none shadow-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HistoryIcon className="h-5 w-5 text-amber-500" />
                Workflow Timeline
              </CardTitle>
              <CardDescription>Tracking verification stages.</CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              {claim.history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-muted-foreground italic text-sm text-center">
                  <Clock className="h-8 w-8 mb-2 opacity-20" />
                  No verification actions recorded yet.
                </div>
              ) : (
                <div className="relative pl-6 space-y-8 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-slate-100">
                  {claim.history.map((action, idx) => (
                    <div key={action.id} className="relative">
                      {/* Timeline Dot */}
                      <div
                        className={`absolute left-[21px] top-1.5 h-4 w-4 rounded-full border-2 border-white shadow-sm ring-2 ${
                          idx === 0
                            ? "ring-indigo-500 bg-indigo-500"
                            : "ring-slate-100 bg-slate-200"
                        }`}
                      />

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-bold leading-none">
                            {action.action_type.replace(/_/g, " ")}
                          </p>
                          <time className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {format(parseISO(action.acted_at), "MMM d, HH:mm")}
                          </time>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                            By {action.actor?.full_name || "System"}
                          </span>
                          {action.to_status && (
                            <ArrowRight className="h-2 w-2 text-slate-300" />
                          )}
                          {action.to_status && (
                            <span className="text-[10px] font-medium text-indigo-600">
                              {action.to_status}
                            </span>
                          )}
                        </div>

                        {action.comment && (
                          <div className="mt-2 text-xs p-3 bg-amber-50/50 border border-amber-100 rounded-lg text-amber-900 leading-relaxed relative">
                            <MessageSquare className="h-3 w-3 absolute -left-1.5 top-2 bg-amber-50 rounded-full" />
                            {action.comment}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
