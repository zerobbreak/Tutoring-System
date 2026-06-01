import type { NavigateOptions } from "@tanstack/react-router";
import { Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Skeleton } from "#/components/ui/skeleton";
import {
  listLecturerTutorsFn,
  type LecturerTutorCardDTO,
  type LecturerTutorsPageDataDTO,
} from "#/server-actions/lecturer-tutors";
import { AssignTutorDialog } from "./assign-tutor-dialog";
import { LecturerTutorCard } from "./lecturer-tutor-card";
import { LecturerTutorDetailSheet } from "./lecturer-tutor-detail-sheet";
import { TutorsEmptyState } from "./tutors-empty-state";

export type LecturerTutorsSearch = {
  tutor?: string;
};

type LecturerTutorsViewProps = {
  search: LecturerTutorsSearch;
  navigate: (opts: NavigateOptions) => void | Promise<void>;
};

function TutorCardSkeleton() {
  return (
    <div className="rounded-lg border border-border/80 bg-card p-4">
      <div className="flex gap-3">
        <Skeleton className="size-10 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function LecturerTutorsView({
  search,
  navigate,
}: LecturerTutorsViewProps) {
  const [booting, setBooting] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [data, setData] = useState<LecturerTutorsPageDataDTO | null>(null);
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedTutorId, setSelectedTutorId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(async () => {
    setBooting(true);
    setLoadError(null);
    try {
      const result = await listLecturerTutorsFn();
      setData(result);
    } catch (e) {
      setLoadError(
        e instanceof Error ? e.message : "Failed to load tutors",
      );
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (search.tutor) {
      setSelectedTutorId(search.tutor);
      setSheetOpen(true);
    }
  }, [search.tutor]);

  const filteredTutors = useMemo(() => {
    const list = data?.tutors ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((t) => {
      if (!showInactive && t.isInactive) return false;
      if (!q) return true;
      return (
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.assignedModules.some((m) =>
          m.moduleCode.toLowerCase().includes(q),
        )
      );
    });
  }, [data?.tutors, query, showInactive]);

  const openTutor = (tutor: LecturerTutorCardDTO) => {
    setSelectedTutorId(tutor.id);
    setSheetOpen(true);
    void navigate({
      to: "/lecturer/tutors",
      search: { tutor: tutor.id },
      replace: true,
    });
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSheetOpen(false);
      setSelectedTutorId(null);
      void navigate({
        to: "/lecturer/tutors",
        search: { tutor: undefined },
        replace: true,
      });
    } else {
      setSheetOpen(true);
    }
  };

  const handleMessage = (conversationId: string) => {
    void navigate({
      to: "/lecturer/messages",
      search: { conversation: conversationId },
    });
  };

  const inactiveCount =
    data?.tutors.filter((t) => t.isInactive).length ?? 0;
  const totalCount = data?.tutors.length ?? 0;
  const pendingTotal =
    data?.tutors.reduce((sum, t) => sum + t.pendingClaims, 0) ?? 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain p-6 pb-10 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="shrink-0">
            <h2 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Users className="size-7 text-(--lagoon-deep)" />
              Tutors
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Manage tutors on your modules, review performance, and track
              workload.
            </p>
          </div>
          <Button
            className="shrink-0 shadow-sm"
            onClick={() => setAssignOpen(true)}
          >
            <Plus className="mr-2 size-4" />
            Add tutor
          </Button>
        </div>

        {loadError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {loadError}
          </div>
        ) : null}

        {!booting && totalCount > 0 ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="border-border/80 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Active tutors</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {totalCount - inactiveCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Pending claims</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-amber-800">
                  {pendingTotal}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/80 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Your modules</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {data?.modules.length ?? 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        ) : null}

        <Card className="shrink-0 border-border/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Find tutors</CardTitle>
            <CardDescription>
              Search by name, email, or module code
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tutors…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              variant={showInactive ? "secondary" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? "Hide" : "Show"} inactive ({inactiveCount})
            </Button>
          </CardContent>
        </Card>

        {booting ? (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <li key={i}>
                <TutorCardSkeleton />
              </li>
            ))}
          </ul>
        ) : filteredTutors.length === 0 ? (
          <TutorsEmptyState
            variant={totalCount === 0 ? "no-tutors" : "no-results"}
            onAssign={totalCount === 0 ? () => setAssignOpen(true) : undefined}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filteredTutors.map((tutor) => (
              <li key={tutor.id}>
                <LecturerTutorCard
                  tutor={tutor}
                  selected={selectedTutorId === tutor.id && sheetOpen}
                  onSelect={openTutor}
                />
              </li>
            ))}
          </ul>
        )}

        <AssignTutorDialog
          open={assignOpen}
          onOpenChange={setAssignOpen}
          modules={data?.modules ?? []}
          onAssigned={() => void load()}
        />

        <LecturerTutorDetailSheet
          tutorId={selectedTutorId}
          open={sheetOpen}
          onOpenChange={handleSheetOpenChange}
          onUpdated={() => void load()}
          onMessage={handleMessage}
          modules={data?.modules ?? []}
        />
      </div>
    </div>
  );
}
