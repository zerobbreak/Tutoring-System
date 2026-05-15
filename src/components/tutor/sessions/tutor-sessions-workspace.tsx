import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { format, parseISO, startOfDay } from "date-fns";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  ClipboardList,
  GripVertical,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Plus,
  QrCode,
  Search,
  StickyNote,
  Upload,
  Video,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RadialBar,
  RadialBarChart,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { Avatar, AvatarFallback } from "#/components/ui/avatar";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Calendar } from "#/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { ScrollArea } from "#/components/ui/scroll-area";
import { Skeleton } from "#/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "#/components/ui/tooltip";
import {
  sessionBoundsLocal,
  sessionKanbanColumn,
  type ClaimStatus,
  type SessionKanbanColumnId,
} from "#/lib/session-kanban-column";
import { fileToBase64 } from "#/lib/file-base64";
import {
  claimBadgeLabel,
  claimBadgeVariant,
  formatClock,
} from "#/lib/session-claim-display";
import { toast } from "#/lib/toast";
import { cn } from "#/lib/utils";
import {
  createSessionClaimFn,
  listAttendanceEvidenceFn,
  listTutorModuleAssignmentsFn,
  listTutorSessionClaimsFn,
  registerAttendanceEvidenceFn,
  submitSessionClaimFn,
  updateSessionClaimSchedulingFn,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

const DROP_PREFIX = "kanban-drop:";

const ALL_STATUSES: ClaimStatus[] = [
  "DRAFT",
  "PENDING_VERIFICATION",
  "DISPUTED",
  "REJECTED",
  "VERIFIED",
  "APPROVED",
];

const COLUMN_META: Record<
  SessionKanbanColumnId,
  { title: string; description: string }
> = {
  claimsPending: {
    title: "Claims pending",
    description: "Drafts and items awaiting verification",
  },
  today: {
    title: "Today's sessions",
    description: "Happening today on your timetable",
  },
  upcoming: {
    title: "Upcoming sessions",
    description: "Scheduled ahead on the calendar",
  },
  completed: {
    title: "Completed sessions",
    description: "Past slots you have already delivered",
  },
};

function claimTimes(claim: TutorSessionClaimDTO) {
  return {
    start: claim.start_time ?? "09:00",
    end: claim.end_time ?? "10:00",
  };
}

function isSessionLive(claim: TutorSessionClaimDTO, now: Date): boolean {
  const times = claimTimes(claim);
  const { start, end } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  return now >= start && now <= end;
}

function isSessionUrgent(claim: TutorSessionClaimDTO, now: Date): boolean {
  if (claim.status === "DISPUTED" || claim.status === "REJECTED") return true;
  const times = claimTimes(claim);
  const { start } = sessionBoundsLocal(
    claim.session_date,
    times.start,
    times.end,
  );
  const ms = start.getTime() - now.getTime();
  if (ms <= 0 || ms > 2 * 60 * 60 * 1000) return false;
  return true;
}

function DroppableColumn({
  id,
  children,
  className,
}: {
  id: SessionKanbanColumnId;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${DROP_PREFIX}${id}`,
    disabled: id === "claimsPending",
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col rounded-xl border bg-card/60 shadow-sm transition-colors",
        isOver && id !== "claimsPending" && "border-lagoon-deep/50 bg-lagoon/5",
        className,
      )}
    >
      {children}
    </div>
  );
}

function DraggableSessionCard({
  claim,
  columnId,
  onOpen,
  onQr,
  onUpload,
  onAttendance,
  onSubmit,
  onWorkspace,
  now,
}: {
  claim: TutorSessionClaimDTO;
  columnId: SessionKanbanColumnId;
  onOpen: () => void;
  onQr: () => void;
  onUpload: () => void;
  onAttendance: () => void;
  onSubmit: () => void;
  onWorkspace: () => void;
  now: Date;
}) {
  const reduceMotion = useReducedMotion();
  const dragDisabled = columnId === "claimsPending";
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: claim.id,
      disabled: dragDisabled,
      data: { columnId },
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const mod = claim.module;
  const titleLine = mod
    ? `${mod.code} — ${mod.name}`
    : "Unknown module";
  const lecturerName = mod?.lecturer?.full_name ?? "Lecturer";
  const initials = lecturerName
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const expected = claim.attendance_expected_count;
  const present = claim.attendance_present_count;
  const hasHeadcount =
    expected != null && expected > 0 && present != null && present >= 0;
  const progressRatio = hasHeadcount
    ? Math.min(1, (present as number) / (expected as number))
    : claim.evidenceCount > 0
      ? 1
      : 0;
  const progressLabel = hasHeadcount
    ? `${present}/${expected} students`
    : claim.evidenceCount > 0
      ? "Register on file"
      : "Attendance —";

  const radialData = [{ name: "att", value: Math.round(progressRatio * 100) }];

  const live = isSessionLive(claim, now);
  const urgent = isSessionUrgent(claim, now);

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout={!reduceMotion}
      initial={false}
      animate={
        reduceMotion
          ? undefined
          : { opacity: isDragging ? 0.85 : 1, scale: isDragging ? 1.01 : 1 }
      }
      transition={{ type: "spring", stiffness: 420, damping: 32 }}
      className="touch-manipulation"
    >
      <Card
        className={cn(
          "border-border/80 bg-card/95 shadow-xs transition-shadow hover:shadow-md",
          urgent && "border-amber-500/45 ring-1 ring-amber-500/25",
          live && "border-emerald-500/40 ring-1 ring-emerald-500/20",
        )}
      >
        <CardHeader className="gap-2 pb-2">
          <div className="flex items-start gap-2">
            {!dragDisabled ? (
              <button
                type="button"
                className="mt-0.5 cursor-grab rounded-md border border-transparent p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                aria-label="Drag to reschedule"
                {...listeners}
                {...attributes}
              >
                <GripVertical className="size-4" />
              </button>
            ) : (
              <span className="mt-0.5 inline-flex w-6 justify-center p-1 text-muted-foreground/40">
                <GripVertical className="size-4" />
              </span>
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                {live ? (
                  <Badge variant="success" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <CircleDot className="size-3" />
                    Live
                  </Badge>
                ) : null}
                {urgent && !live ? (
                  <Badge variant="warning" className="gap-0.5 px-1.5 py-0 text-[10px]">
                    <AlertTriangle className="size-3" />
                    Urgent
                  </Badge>
                ) : null}
                <CardTitle className="text-sm leading-snug font-semibold">
                  {titleLine}
                </CardTitle>
              </div>
              <CardDescription className="text-xs">
                {format(parseISO(`${claim.session_date}T12:00:00`), "EEE d MMM")}{" "}
                · {formatClock(claim.start_time)}–{formatClock(claim.end_time)}
                {claim.venue ? ` · ${claim.venue}` : ""}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="xs" className="shrink-0">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={onWorkspace}>
                  Open session
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onUpload}>
                  Upload register
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onQr}>Generate QR</DropdownMenuItem>
                <DropdownMenuItem onSelect={onAttendance}>
                  View attendance
                </DropdownMenuItem>
                {claim.status === "DRAFT" ? (
                  <DropdownMenuItem onSelect={onSubmit}>
                    Submit claim
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to="/tutor/notes"
                    search={{ claim: claim.id, focus: Date.now() }}
                  >
                    Add notes
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    to="/tutor/messaging"
                    search={
                      mod?.lecturer_id
                        ? { lecturer: mod.lecturer_id }
                        : undefined
                    }
                  >
                    Message lecturer
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pb-4">
          <div className="flex items-center gap-3">
            <div className="relative size-14 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={radialData}
                  innerRadius={18}
                  outerRadius={28}
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={4}
                    fill="hsl(var(--chart-2))"
                    background={{ fill: "hsl(var(--muted))" }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
                {hasHeadcount || claim.evidenceCount > 0 ? (
                  <>{Math.round(progressRatio * 100)}%</>
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">{progressLabel}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={claimBadgeVariant(claim.status)}>
                  {claimBadgeLabel(claim.status)}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex text-muted-foreground">
                      <QrCode className="size-3.5" aria-hidden />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>QR actions in the menu</TooltipContent>
                </Tooltip>
                {(claim.notes?.trim() || claim.topics_covered?.trim()) && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex text-lagoon-deep">
                        <StickyNote className="size-3.5" aria-hidden />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent>Notes or coverage on file</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </div>
            <Avatar className="size-9 shrink-0 border border-border/60">
              <AvatarFallback className="text-[10px] font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{lecturerName}</span>
            <Button variant="outline" size="xs" onClick={onOpen}>
              Details
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

type SessionsSearch = { claim?: string };

type TutorSessionsWorkspaceProps = {
  search: SessionsSearch;
  navigate: (opts: {
    to: string;
    search?: Record<string, unknown>;
    replace?: boolean;
  }) => void | Promise<void>;
};

export function TutorSessionsWorkspace({
  search,
  navigate,
}: TutorSessionsWorkspaceProps) {
  const reduceMotion = useReducedMotion();

  const [claims, setClaims] = useState<TutorSessionClaimDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [searchText, setSearchText] = useState("");
  const [moduleFilter, setModuleFilter] = useState<string | "all">("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickOpen, setDatePickOpen] = useState(false);
  const [datePickTemp, setDatePickTemp] = useState<Date | undefined>(undefined);
  const [statusFilters, setStatusFilters] = useState<Set<ClaimStatus>>(
    () => new Set(ALL_STATUSES),
  );
  const [calendarMonth, setCalendarMonth] = useState(() => startOfDay(new Date()));

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailClaim, setDetailClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [qrOpen, setQrOpen] = useState(false);
  const [qrClaim, setQrClaim] = useState<TutorSessionClaimDTO | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadClaim, setUploadClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [uploadBusy, setUploadBusy] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [attendanceClaim, setAttendanceClaim] =
    useState<TutorSessionClaimDTO | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<
    Awaited<ReturnType<typeof listAttendanceEvidenceFn>> | null
  >(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitClaim, setSubmitClaim] = useState<TutorSessionClaimDTO | null>(
    null,
  );
  const [submitBusy, setSubmitBusy] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [modules, setModules] = useState<
    Awaited<ReturnType<typeof listTutorModuleAssignmentsFn>>
  >([]);
  const [createModuleId, setCreateModuleId] = useState<string>("");
  const [createDate, setCreateDate] = useState<Date>(() => new Date());
  const [createStart, setCreateStart] = useState("09:00");
  const [createEnd, setCreateEnd] = useState("10:00");
  const [createVenue, setCreateVenue] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);


  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listTutorSessionClaimsFn();
      setClaims(rows);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Could not load teaching sessions",
      );
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!search.claim || claims.length === 0) return;
    const hit = claims.find((c) => c.id === search.claim);
    if (hit) {
      setDetailClaim(hit);
      setDetailOpen(true);
    }
  }, [search.claim, claims]);

  useEffect(() => {
    if (!createOpen) return;
    void (async () => {
      try {
        const m = await listTutorModuleAssignmentsFn();
        setModules(m);
        setCreateModuleId((prev) => prev || m[0]?.moduleId || "");
      } catch {
        setModules([]);
      }
    })();
  }, [createOpen]);

  const moduleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of claims) {
      if (c.module) map.set(c.module.id, `${c.module.code} — ${c.module.name}`);
    }
    return [...map.entries()];
  }, [claims]);

  const filteredClaims = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return claims.filter((c) => {
      if (!statusFilters.has(c.status)) return false;
      if (moduleFilter !== "all" && c.module_id !== moduleFilter) return false;
      if (dateFilter && c.session_date !== format(dateFilter, "yyyy-MM-dd"))
        return false;
      if (!q) return true;
      const blob = [
        c.module?.code,
        c.module?.name,
        c.venue,
        c.session_kind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [claims, searchText, moduleFilter, dateFilter, statusFilters]);

  const columns = useMemo(() => {
    const buckets: Record<SessionKanbanColumnId, TutorSessionClaimDTO[]> = {
      claimsPending: [],
      today: [],
      upcoming: [],
      completed: [],
    };
    for (const c of filteredClaims) {
      const times = claimTimes(c);
      const col = sessionKanbanColumn(
        now,
        c.session_date,
        times.start,
        times.end,
        c.status,
      );
      buckets[col].push(c);
    }
    const sortFn = (a: TutorSessionClaimDTO, b: TutorSessionClaimDTO) => {
      const da = `${a.session_date}T${formatClock(a.start_time)}:00`;
      const db = `${b.session_date}T${formatClock(b.start_time)}:00`;
      return da.localeCompare(db);
    };
    for (const k of Object.keys(buckets) as SessionKanbanColumnId[]) {
      buckets[k].sort(sortFn);
    }
    return buckets;
  }, [filteredClaims, now]);

  const stats = useMemo(() => {
    const total = filteredClaims.length;
    const pendingClaims = filteredClaims.filter((c) =>
      ["DRAFT", "PENDING_VERIFICATION", "DISPUTED", "REJECTED"].includes(c.status),
    ).length;
    const withEvidence = filteredClaims.filter((c) => c.evidenceCount > 0).length;
    const attendanceRate =
      total === 0 ? 0 : Math.round((withEvidence / total) * 1000) / 10;
    const upcomingSessions = filteredClaims.filter(
      (c) =>
        (() => {
          const times = claimTimes(c);
          return sessionKanbanColumn(
            now,
            c.session_date,
            times.start,
            times.end,
            c.status,
          );
        })() === "upcoming",
    ).length;
    return { total, pendingClaims, attendanceRate, upcomingSessions };
  }, [filteredClaims, now]);

  const toggleStatus = (s: ClaimStatus) => {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return new Set(ALL_STATUSES);
      return next;
    });
  };

  const closeDetailSearch = () => {
    setDetailOpen(false);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: undefined },
      replace: true,
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const from = active.data.current?.columnId as SessionKanbanColumnId | undefined;
    const overId = String(over.id);
    if (!overId.startsWith(DROP_PREFIX)) return;
    const to = overId.slice(DROP_PREFIX.length) as SessionKanbanColumnId;
    if (!from || from === "claimsPending" || to === "claimsPending") return;
    if (from === to) return;
    if (to !== "today" && to !== "upcoming" && to !== "completed") return;
    try {
      await updateSessionClaimSchedulingFn({
        data: { claimId: String(active.id), targetColumn: to },
      });
      toast.success("Session rescheduled");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reschedule");
    }
  };

  const openWorkspace = (c: TutorSessionClaimDTO) => {
    setDetailClaim(c);
    setDetailOpen(true);
    void navigate({
      to: "/tutor/sessions",
      search: { claim: c.id },
      replace: true,
    });
  };

  const sessionQrValue =
    typeof window !== "undefined" && qrClaim
      ? `${window.location.origin}/tutor/sessions?claim=${qrClaim.id}`
      : "";

  return (
    <TooltipProvider delayDuration={200}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <ScrollArea className="h-screen w-full">
          <div className="flex min-h-full flex-col gap-6 p-4 md:p-8">
          <header className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <Video className="size-7 text-lagoon-deep" aria-hidden />
                <div>
                  <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                    Sessions workspace
                  </h1>
                  <p className="max-w-2xl text-sm text-muted-foreground">
                    Operational hub for live teaching: attendance, claims, registers,
                    and quick hand-offs to notes or messaging.
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search sessions..."
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Module
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem onSelect={() => setModuleFilter("all")}>
                    All modules
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {moduleOptions.map(([id, label]) => (
                    <DropdownMenuItem key={id} onSelect={() => setModuleFilter(id)}>
                      {label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Date
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuItem onSelect={() => setDateFilter(undefined)}>
                    Any date
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => setDateFilter(startOfDay(new Date()))}
                  >
                    Today only
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => {
                      setDatePickTemp(dateFilter ?? new Date());
                      setDatePickOpen(true);
                    }}
                  >
                    Pick date…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Dialog open={datePickOpen} onOpenChange={setDatePickOpen}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter by date</DialogTitle>
                    <DialogDescription>
                      Only sessions on this day are shown in the board and stats.
                    </DialogDescription>
                  </DialogHeader>
                  <Calendar
                    mode="single"
                    selected={datePickTemp}
                    onSelect={setDatePickTemp}
                    className="mx-auto rounded-md border p-2"
                  />
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDatePickOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      onClick={() => {
                        if (datePickTemp) setDateFilter(datePickTemp);
                        setDatePickOpen(false);
                      }}
                    >
                      Apply
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Claim status
                    <ChevronDown className="size-4 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuLabel>Visible statuses</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {ALL_STATUSES.map((s) => (
                    <DropdownMenuCheckboxItem
                      key={s}
                      checked={statusFilters.has(s)}
                      onCheckedChange={() => toggleStatus(s)}
                    >
                      {claimBadgeLabel(s)}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {dateFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>
                Filtered to {format(dateFilter, "d MMM yyyy")} ·{" "}
                <button
                  type="button"
                  className="font-medium text-lagoon-deep underline-offset-2 hover:underline"
                  onClick={() => setDateFilter(undefined)}
                >
                  Clear date
                </button>
              </span>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Total sessions</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {loading ? "—" : stats.total}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Pending claims</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-amber-700 dark:text-amber-300">
                  {loading ? "—" : stats.pendingClaims}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Attendance coverage</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-emerald-700 dark:text-emerald-300">
                  {loading ? "—" : `${stats.attendanceRate}%`}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <CardDescription>Upcoming sessions</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {loading ? "—" : stats.upcomingSessions}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Tabs defaultValue="kanban" className="min-h-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="kanban" className="gap-1.5">
                  <LayoutGrid className="size-4" />
                  Kanban
                </TabsTrigger>
                <TabsTrigger value="calendar" className="gap-1.5">
                  <CalendarRange className="size-4" />
                  Calendar
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="kanban" className="mt-4 min-h-0 flex-1">
              {loading ? (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-[420px] rounded-xl" />
                  ))}
                </div>
              ) : (
                <ScrollArea className="w-full overflow-x-auto">
                  <div className="flex min-h-[min(70vh,720px)] gap-4 pb-4">
                  {(Object.keys(COLUMN_META) as SessionKanbanColumnId[]).map(
                    (colId) => (
                      <DroppableColumn key={colId} id={colId} className="min-h-[320px] min-w-[300px] flex-1">
                        <div className="sticky top-0 z-10 border-b border-border/60 bg-card/95 px-3 py-2 backdrop-blur-sm">
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                {COLUMN_META[colId].title}
                              </p>
                              <p className="text-[11px] text-muted-foreground/90">
                                {COLUMN_META[colId].description}
                              </p>
                            </div>
                            <Badge variant="secondary" className="tabular-nums">
                              {columns[colId].length}
                            </Badge>
                          </div>
                        </div>
                        <ScrollArea className="min-h-0 max-h-[min(560px,60vh)] flex-1 px-2 pb-3">
                          <div className="flex flex-col gap-2 pt-2">
                            <AnimatePresence initial={false}>
                              {columns[colId].length === 0 ? (
                                <motion.div
                                  key="empty"
                                  initial={
                                    reduceMotion ? false : { opacity: 0, y: 6 }
                                  }
                                  animate={{ opacity: 1, y: 0 }}
                                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-4 py-10 text-center text-xs text-muted-foreground"
                                >
                                  <ClipboardList className="size-8 opacity-40" />
                                  <p>No sessions in this lane yet.</p>
                                </motion.div>
                              ) : (
                                columns[colId].map((c) => (
                                  <DraggableSessionCard
                                    key={c.id}
                                    claim={c}
                                    columnId={colId}
                                    now={now}
                                    onOpen={() => openWorkspace(c)}
                                    onQr={() => {
                                      setQrClaim(c);
                                      setQrOpen(true);
                                    }}
                                    onUpload={() => {
                                      setUploadClaim(c);
                                      setUploadOpen(true);
                                    }}
                                    onAttendance={async () => {
                                      setAttendanceClaim(c);
                                      setAttendanceOpen(true);
                                      try {
                                        const rows = await listAttendanceEvidenceFn({
                                          data: { claimId: c.id },
                                        });
                                        setAttendanceRows(rows);
                                      } catch (e) {
                                        toast.error(
                                          e instanceof Error
                                            ? e.message
                                            : "Could not load evidence",
                                        );
                                        setAttendanceRows([]);
                                      }
                                    }}
                                    onSubmit={() => {
                                      setSubmitClaim(c);
                                      setSubmitOpen(true);
                                    }}
                                    onWorkspace={() => openWorkspace(c)}
                                  />
                                ))
                              )}
                            </AnimatePresence>
                          </div>
                        </ScrollArea>
                      </DroppableColumn>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="calendar" className="mt-4">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
                <Card className="border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base">Month</CardTitle>
                    <CardDescription>
                      Same filters as the board; pick a day to inspect sessions.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Calendar
                      mode="single"
                      month={calendarMonth}
                      onMonthChange={setCalendarMonth}
                      selected={dateFilter}
                      onSelect={(d) => setDateFilter(d ?? undefined)}
                      className="rounded-md border p-2"
                    />
                  </CardContent>
                </Card>
                <Card className="min-h-[360px] border-border/70">
                  <CardHeader>
                    <CardTitle className="text-base">
                      {dateFilter
                        ? format(dateFilter, "EEEE d MMMM yyyy")
                        : "Pick a date"}
                    </CardTitle>
                    <CardDescription>
                      {dateFilter
                        ? `${filteredClaims.filter((c) => c.session_date === format(dateFilter, "yyyy-MM-dd")).length} session(s) match filters.`
                        : "Select a date on the calendar."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {dateFilter ? (
                      filteredClaims
                        .filter(
                          (c) =>
                            c.session_date === format(dateFilter, "yyyy-MM-dd"),
                        )
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => openWorkspace(c)}
                            className="flex w-full items-center justify-between rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-left text-sm shadow-xs transition hover:bg-muted/40"
                          >
                            <span className="font-medium">
                              {c.module?.code} · {formatClock(c.start_time)}
                            </span>
                            <Badge variant={claimBadgeVariant(c.status)}>
                              {claimBadgeLabel(c.status)}
                            </Badge>
                          </button>
                        ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Choose a day to list sessions.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          <Button
            type="button"
            size="lg"
            className="fixed bottom-6 right-6 z-40 h-12 rounded-full px-5 shadow-lg"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-5" />
            Create session
          </Button>

          <Dialog
            open={detailOpen}
            onOpenChange={(o) => {
              if (!o) closeDetailSearch();
            }}
          >
            <DialogContent className="max-h-[90vh] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Session workspace</DialogTitle>
                <DialogDescription>
                  {detailClaim?.module
                    ? `${detailClaim.module.code} — ${detailClaim.module.name}`
                    : "Session"}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[60vh] pr-4">
                {detailClaim ? (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                    <span>Date</span>
                    <span className="text-foreground">
                      {format(
                        parseISO(`${detailClaim.session_date}T12:00:00`),
                        "d MMM yyyy",
                      )}
                    </span>
                    <span>Time</span>
                    <span className="text-foreground">
                      {formatClock(detailClaim.start_time)}–
                      {formatClock(detailClaim.end_time)}
                    </span>
                    <span>Venue</span>
                    <span className="text-foreground">
                      {detailClaim.venue ?? "—"}
                    </span>
                    <span>Hours</span>
                    <span className="text-foreground">{detailClaim.hours}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={claimBadgeVariant(detailClaim.status)}>
                      {claimBadgeLabel(detailClaim.status)}
                    </Badge>
                    {detailClaim.session_kind ? (
                      <Badge variant="outline">{detailClaim.session_kind}</Badge>
                    ) : null}
                  </div>
                  {detailClaim.topics_covered ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Topics covered
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
                        {detailClaim.topics_covered}
                      </p>
                    </div>
                  ) : null}
                  {detailClaim.notes ? (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        Notes
                      </p>
                      <p className="mt-1 whitespace-pre-wrap rounded-md border bg-muted/30 p-2 text-xs">
                        {detailClaim.notes}
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
              </ScrollArea>
              <DialogFooter className="gap-2 sm:justify-between">
                <Button variant="outline" asChild>
                  <Link
                    to="/tutor/notes"
                    search={{
                      claim: detailClaim?.id,
                      focus: Date.now(),
                    }}
                  >
                    <StickyNote className="size-4" />
                    Open notes
                  </Link>
                </Button>
                <Button onClick={closeDetailSearch}>Close</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Session QR</DialogTitle>
                <DialogDescription>
                  Scan to return tutors straight to this session workspace.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-3 py-2">
                {qrClaim ? (
                  <>
                    <div className="rounded-lg border bg-white p-3">
                      <QRCodeSVG value={sessionQrValue} size={180} level="M" />
                    </div>
                    <p className="break-all text-center text-xs text-muted-foreground">
                      {sessionQrValue}
                    </p>
                  </>
                ) : null}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload register</DialogTitle>
                <DialogDescription>
                  Attach a class register or attendance sheet (max 12MB).
                </DialogDescription>
              </DialogHeader>
              {uploadClaim ? (
                <form
                  className="space-y-3"
                  onSubmit={async (ev) => {
                    ev.preventDefault();
                    const fd = new FormData(ev.currentTarget);
                    const file = fd.get("file");
                    if (!(file instanceof File) || file.size === 0) {
                      toast.error("Choose a file first.");
                      return;
                    }
                    setUploadBusy(true);
                    try {
                      const b64 = await fileToBase64(file);
                      await registerAttendanceEvidenceFn({
                        data: {
                          claimId: uploadClaim.id,
                          fileBase64: b64,
                          fileName: file.name,
                          mimeType: file.type || "application/octet-stream",
                        },
                      });
                      toast.success("Register uploaded");
                      setUploadOpen(false);
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Upload failed",
                      );
                    } finally {
                      setUploadBusy(false);
                    }
                  }}
                >
                  <Input name="file" type="file" required />
                  <DialogFooter>
                    <Button type="submit" disabled={uploadBusy}>
                      {uploadBusy ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Uploading
                        </>
                      ) : (
                        <>
                          <Upload className="size-4" />
                          Upload
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              ) : null}
            </DialogContent>
          </Dialog>

          <Dialog open={attendanceOpen} onOpenChange={setAttendanceOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Attendance evidence</DialogTitle>
                <DialogDescription>
                  {attendanceClaim?.module
                    ? `${attendanceClaim.module.code} — files linked to this session.`
                    : "Files linked to this session claim."}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-64 pr-4">
                <div className="space-y-2 text-sm">
                {attendanceRows?.length ? (
                  attendanceRows.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5"
                    >
                      <span className="truncate">{r.original_filename}</span>
                      {r.signedUrl ? (
                        <Button variant="link" size="sm" asChild>
                          <a href={r.signedUrl} target="_blank" rel="noreferrer">
                            Open
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No files uploaded yet.</p>
                )}
                </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>

          <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Submit claim</DialogTitle>
                <DialogDescription>
                  Sends this session to pending verification with a timestamp.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSubmitOpen(false)}>
                  Cancel
                </Button>
                <Button
                  disabled={submitBusy}
                  onClick={async () => {
                    if (!submitClaim) return;
                    setSubmitBusy(true);
                    try {
                      await submitSessionClaimFn({
                        data: { claimId: submitClaim.id },
                      });
                      toast.success("Claim submitted");
                      setSubmitOpen(false);
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Submit failed",
                      );
                    } finally {
                      setSubmitBusy(false);
                    }
                  }}
                >
                  {submitBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="size-4" />
                  )}
                  Confirm submit
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create session</DialogTitle>
                <DialogDescription>
                  Adds a draft claim on your assigned modules.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 py-1">
                <div className="grid gap-1.5">
                  <Label>Module</Label>
                  <select
                    className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
                    value={createModuleId}
                    onChange={(e) => setCreateModuleId(e.target.value)}
                  >
                    {modules.map((m) => (
                      <option key={m.moduleId} value={m.moduleId}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Date</Label>
                  <Calendar
                    mode="single"
                    selected={createDate}
                    onSelect={(d) => d && setCreateDate(d)}
                    className="rounded-md border p-2"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="grid gap-1.5">
                    <Label>Start</Label>
                    <Input
                      value={createStart}
                      onChange={(e) => setCreateStart(e.target.value)}
                      placeholder="09:00"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label>End</Label>
                    <Input
                      value={createEnd}
                      onChange={(e) => setCreateEnd(e.target.value)}
                      placeholder="10:00"
                    />
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label>Venue (optional)</Label>
                  <Input
                    value={createVenue}
                    onChange={(e) => setCreateVenue(e.target.value)}
                    placeholder="Room or link"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={createBusy || !createModuleId}
                  onClick={async () => {
                    setCreateBusy(true);
                    try {
                      await createSessionClaimFn({
                        data: {
                          moduleId: createModuleId,
                          sessionDate: format(createDate, "yyyy-MM-dd"),
                          startTime: createStart,
                          endTime: createEnd,
                          venue: createVenue || undefined,
                        },
                      });
                      toast.success("Session created");
                      setCreateOpen(false);
                      await reload();
                    } catch (e) {
                      toast.error(
                        e instanceof Error ? e.message : "Could not create",
                      );
                    } finally {
                      setCreateBusy(false);
                    }
                  }}
                >
                  {createBusy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : null}
                  Save draft
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </div>
        </ScrollArea>
      </DndContext>
    </TooltipProvider>
  );
}
