import { format, isAfter, parseISO } from "date-fns";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  QrCode,
  RefreshCw,
  Search,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { ScrollArea } from "#/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { toast } from "#/lib/toast";
import {
  generateSessionTokenFn,
  getAttendanceDataFn,
  getHistoricalAttendanceFn,
  listTutorSessionClaimsFn,
  registerStudentForSessionFn,
  type AttendanceRecordDTO,
  type TutorSessionClaimDTO,
} from "#/server-actions/tutor-sessions";

export function TutorRegisterGenerationPage() {
  const [sessions, setSessions] = useState<TutorSessionClaimDTO[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceRecordDTO[]>([]);
  const [historicalData, setHistoricalData] = useState<
    { date: string; present: number; expected: number }[]
  >([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [registerForm, setRegisterForm] = useState({
    fullName: "",
    studentReference: "",
    email: "",
  });
  const [activeTab, setActiveTab] = useState<"live" | "analytics">("live");

  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId),
    [sessions, selectedSessionId],
  );

  const loadSessions = useCallback(async () => {
    try {
      const data = await listTutorSessionClaimsFn();
      setSessions(data);
      if (data.length > 0 && !selectedSessionId) {
        setSelectedSessionId(data[0].id);
      }
    } catch (err) {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId]);

  const loadAttendance = useCallback(async () => {
    if (!selectedSessionId) return;
    setAttendanceLoading(true);
    try {
      const data = await getAttendanceDataFn({
        data: { claimId: selectedSessionId },
      });
      setAttendance(data);
    } catch (err) {
      toast.error("Failed to load attendance roster");
    } finally {
      setAttendanceLoading(false);
    }
  }, [selectedSessionId]);

  const loadHistorical = useCallback(async () => {
    try {
      const data = await getHistoricalAttendanceFn();
      setHistoricalData(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadSessions();
    loadHistorical();
  }, [loadSessions, loadHistorical]);

  useEffect(() => {
    if (selectedSessionId) {
      loadAttendance();
      // Polling for live attendance every 10 seconds
      const interval = setInterval(loadAttendance, 10000);
      return () => clearInterval(interval);
    }
  }, [selectedSessionId, loadAttendance]);

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionId) return;
    if (!registerForm.fullName.trim() || !registerForm.studentReference.trim()) {
      toast.error("Full name and student number are required.");
      return;
    }
    setRegistering(true);
    try {
      const result = await registerStudentForSessionFn({
        data: {
          claimId: selectedSessionId,
          fullName: registerForm.fullName.trim(),
          studentReference: registerForm.studentReference.trim(),
          email: registerForm.email.trim() || undefined,
        },
      });
      toast.success(
        result.registered
          ? `${result.studentName} registered and marked present.`
          : `${result.studentName} checked in.`,
      );
      setRegisterForm({ fullName: "", studentReference: "", email: "" });
      setRegisterOpen(false);
      await loadAttendance();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not register student",
      );
    } finally {
      setRegistering(false);
    }
  };

  const handleGenerateQR = async () => {
    if (!selectedSessionId) return;
    setGenerating(true);
    try {
      await generateSessionTokenFn({
        data: { claimId: selectedSessionId, expiresInMinutes: 60 },
      });
      toast.success("Secure QR generated");
      await loadSessions(); // Refresh to get the new token and expiry
    } catch (err) {
      toast.error("Failed to generate QR");
    } finally {
      setGenerating(false);
    }
  };

  const qrValue = useMemo(() => {
    if (!selectedSession?.qr_token || typeof window === "undefined") return "";
    return `${window.location.origin}/student/check-in?token=${selectedSession.qr_token}&session=${selectedSession.id}`;
  }, [selectedSession]);

  const isTokenExpired = useMemo(() => {
    if (!selectedSession?.qr_expires_at) return true;
    return isAfter(new Date(), parseISO(selectedSession.qr_expires_at));
  }, [selectedSession]);

  const filteredAttendance = attendance.filter(
    (a) =>
      a.student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.student.student_reference
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()),
  );

  const stats = useMemo(() => {
    const present = attendance.filter((a) => a.status === "PRESENT").length;
    const late = attendance.filter((a) => a.status === "LATE").length;
    const absent = attendance.filter((a) => a.status === "ABSENT").length;
    const total =
      attendance.length || selectedSession?.attendance_expected_count || 0;
    return { present, late, absent, total };
  }, [attendance, selectedSession]);

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-lagoon-deep" />
      </div>
    );
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="rise-in flex flex-col gap-8 p-4 md:p-8">
      {/* Header & Session Selector */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Attendance Workspace
          </h1>
          <p className="text-muted-foreground">
            Manage live check-ins, generate QR codes, and export reports.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={selectedSessionId}
            onValueChange={setSelectedSessionId}
          >
            <SelectTrigger className="w-[280px] bg-card/50">
              <SelectValue placeholder="Select a session" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  <div className="flex flex-col items-start gap-0.5">
                    <span className="font-medium">
                      {s.module?.code} — {s.module?.name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(parseISO(s.session_date), "MMM d")} ·{" "}
                      {s.start_time?.slice(0, 5) || "--:--"}-
                      {s.end_time?.slice(0, 5) || "--:--"}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={loadSessions}
            title="Refresh sessions"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "live" | "analytics")}
        className="w-full"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="grid w-full grid-cols-2 sm:w-[400px]">
            <TabsTrigger value="live" className="gap-2">
              <LayoutDashboard className="size-4" />
              Live Tracking
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <History className="size-4" />
              Analytics
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2">
              <FileSpreadsheet className="size-4" />
              CSV
            </Button>
            <Button variant="outline" size="sm" className="gap-2">
              <FileText className="size-4" />
              PDF
            </Button>
          </div>
        </div>

        <TabsContent value="live" className="mt-6 space-y-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {/* QR Generator Card */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <QrCode className="size-5 text-lagoon-deep" />
                  Check-in QR
                </CardTitle>
                <CardDescription>
                  Generate a secure, time-limited QR code for students to scan.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-6">
                <div className="relative flex aspect-square w-full max-w-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-border/60 bg-muted/30">
                  {selectedSession?.qr_token && !isTokenExpired ? (
                    <div className="p-2 bg-white rounded-lg">
                      <QRCodeSVG value={qrValue} size={180} />
                    </div>
                  ) : (
                    <div className="text-center p-4">
                      <QrCode className="mx-auto size-12 text-muted-foreground/40 mb-2" />
                      <p className="text-xs text-muted-foreground">
                        No active QR code
                      </p>
                    </div>
                  )}
                  {isTokenExpired && selectedSession?.qr_token && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[1px] rounded-2xl">
                      <Badge variant="destructive">Expired</Badge>
                    </div>
                  )}
                </div>

                <div className="w-full space-y-4">
                  {!isTokenExpired && selectedSession?.qr_expires_at && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Expires at:</span>
                      <span className="font-medium">
                        {format(
                          parseISO(selectedSession.qr_expires_at),
                          "HH:mm",
                        )}
                      </span>
                    </div>
                  )}
                  <Button
                    className="w-full gap-2 bg-lagoon-deep hover:bg-lagoon-deep/90"
                    onClick={handleGenerateQR}
                    disabled={generating}
                  >
                    {generating ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <QrCode className="size-4" />
                    )}
                    {selectedSession?.qr_token && !isTokenExpired
                      ? "Refresh QR Code"
                      : "Generate Secure QR"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Attendance Stats Grid */}
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-lagoon/5 border-lagoon/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Users className="size-4 text-lagoon-deep" />
                      <Badge variant="secondary" className="text-[10px]">
                        Expected
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold">{stats.total}</div>
                  </CardContent>
                </Card>
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <CheckCircle2 className="size-4 text-emerald-600" />
                      <Badge variant="success" className="text-[10px]">
                        Present
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-emerald-600">
                      {stats.present}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <Clock className="size-4 text-amber-600" />
                      <Badge variant="warning" className="text-[10px]">
                        Late
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-amber-600">
                      {stats.late}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-rose-500/5 border-rose-500/20">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <XCircle className="size-4 text-rose-600" />
                      <Badge variant="destructive" className="text-[10px]">
                        Absent
                      </Badge>
                    </div>
                    <div className="mt-2 text-2xl font-bold text-rose-600">
                      {stats.absent}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Roster Table */}
              <Card>
                <CardHeader className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <CardTitle className="text-lg">Student roster</CardTitle>
                    <CardDescription>
                      Live attendance for this session. Institution is set from
                      the module automatically.
                    </CardDescription>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2 bg-lagoon-deep hover:bg-lagoon-deep/90"
                      disabled={!selectedSessionId}
                      onClick={() => setRegisterOpen(true)}
                    >
                      <UserPlus className="size-4" />
                      Register student
                    </Button>
                    <div className="relative w-full sm:w-[200px]">
                      <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Filter students..."
                        className="h-8 pl-9 text-xs"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Student Name</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Check-in Time</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attendanceLoading && attendance.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center">
                              <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
                            </TableCell>
                          </TableRow>
                        ) : filteredAttendance.length === 0 ? (
                          <TableRow>
                            <TableCell
                              colSpan={5}
                              className="h-24 text-center text-muted-foreground"
                            >
                              No students found.
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredAttendance.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.student.full_name}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {record.student.student_reference || "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    record.status === "PRESENT"
                                      ? "success"
                                      : record.status === "LATE"
                                        ? "warning"
                                        : record.status === "ABSENT"
                                          ? "destructive"
                                          : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {record.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {record.check_in_time
                                  ? format(
                                      parseISO(record.check_in_time),
                                      "HH:mm:ss",
                                    )
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="xs">
                                  Edit
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-5 text-lagoon-deep" />
                  Attendance Trends
                </CardTitle>
                <CardDescription>
                  Aggregate presence counts over the last 10 sessions.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="h-[300px] w-full min-h-[300px] min-w-0 shrink-0">
                {activeTab === "analytics" ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
                  <BarChart data={historicalData}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(val) => format(parseISO(val), "MMM d")}
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      labelFormatter={(val) =>
                        format(parseISO(val as string), "PPPP")
                      }
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="present" name="Present" radius={[4, 4, 0, 0]}>
                      {historicalData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill="hsl(var(--chart-2))"
                          fillOpacity={0.8}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="size-5 text-lagoon-deep" />
                  Export Central
                </CardTitle>
                <CardDescription>
                  Generate compliance-ready attendance summaries.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-14"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                      <FileSpreadsheet className="size-5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">
                        Session Summary (CSV)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Raw data for spreadsheet software
                      </span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-14"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                      <FileText className="size-5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">
                        Attendance Register (PDF)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Formal signed-off PDF report
                      </span>
                    </div>
                  </Button>
                  <Button
                    variant="outline"
                    className="justify-start gap-3 h-14"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                      <FileJson className="size-5" />
                    </div>
                    <div className="flex flex-col items-start">
                      <span className="text-sm font-semibold">
                        Integration Export (JSON)
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        For institutional database syncing
                      </span>
                    </div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={registerOpen} onOpenChange={setRegisterOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleRegisterStudent}>
            <DialogHeader>
              <DialogTitle>Register student</DialogTitle>
              <DialogDescription>
                Add a student to your institution roster and mark them present for
                this session.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="register-fullName">Full name</Label>
                <Input
                  id="register-fullName"
                  value={registerForm.fullName}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  placeholder="Student full name"
                  disabled={registering}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-studentReference">Student number</Label>
                <Input
                  id="register-studentReference"
                  value={registerForm.studentReference}
                  onChange={(e) =>
                    setRegisterForm((f) => ({
                      ...f,
                      studentReference: e.target.value,
                    }))
                  }
                  placeholder="e.g. STU12345"
                  disabled={registering}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="register-email">
                  Email{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  value={registerForm.email}
                  onChange={(e) =>
                    setRegisterForm((f) => ({ ...f, email: e.target.value }))
                  }
                  placeholder="student@university.edu"
                  disabled={registering}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRegisterOpen(false)}
                disabled={registering}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-lagoon-deep hover:bg-lagoon-deep/90"
                disabled={registering}
              >
                {registering ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  "Register & mark present"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </ScrollArea>
  );
}
