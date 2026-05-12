import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { isAdminDashboardRole } from "../../lib/user-role";
import { Button } from "../../components/ui/button";
import { cn } from "../../lib/utils";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const role = user?.user_metadata?.role as string | undefined;
      if (!user || !isAdminDashboardRole(role)) {
        navigate({ to: "/auth/login" });
        return;
      }
      setLoading(false);
    };
    checkAuth();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A1128] border-t-transparent" />
      </div>
    );
  }

  const stats = [
    { label: "Total Users", value: "254", icon: "👥", trend: "+12%" },
    { label: "Active Tutors", value: "48", icon: "👨‍🏫", trend: "+5%" },
    { label: "Monthly Revenue", value: "$12,450", icon: "💰", trend: "+18%" },
    { label: "Pending Approvals", value: "7", icon: "⏳", trend: "-2" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-8 lg:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-bold text-[#0A1128]">
              System Administration
            </h1>
            <p className="mt-2 text-gray-500">
              Overview of system performance and user activity.
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="border-[#0A1128] text-[#0A1128]">
              Export Reports
            </Button>
            <Button className="bg-[#0A1128] text-white hover:bg-[#0A1128]/90">
              System Settings
            </Button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0A1128]/5 text-2xl">
                  {stat.icon}
                </div>
                <span className={cn(
                  "text-xs font-bold px-2 py-1 rounded-full",
                  stat.trend.startsWith('+') ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                )}>
                  {stat.trend}
                </span>
              </div>
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className="mt-1 text-3xl font-bold text-[#0A1128]">
                  {stat.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {/* User Management Table Preview */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
              <div className="border-b border-gray-100 p-6">
                <h2 className="font-serif text-2xl font-bold text-[#0A1128]">
                  Recent Registrations
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase text-gray-500">
                    <tr>
                      <th className="px-6 py-4">User</th>
                      <th className="px-6 py-4">Role</th>
                      <th className="px-6 py-4">Joined</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[
                      { name: "John Smith", role: "Tutor", date: "2 mins ago", status: "Active" },
                      { name: "Maria Garcia", role: "Student", date: "15 mins ago", status: "Active" },
                      { name: "David Chen", role: "Tutor", date: "1 hour ago", status: "Pending" },
                      { name: "Alice Wong", role: "Lecturer", date: "3 hours ago", status: "Active" },
                    ].map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 font-medium text-[#0A1128]">{row.name}</td>
                        <td className="px-6 py-4 text-gray-500">{row.role}</td>
                        <td className="px-6 py-4 text-gray-500">{row.date}</td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-block h-2 w-2 rounded-full mr-2",
                            row.status === "Active" ? "bg-green-500" : "bg-yellow-500"
                          )} />
                          {row.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-gray-100 p-4 text-center">
                <Button variant="ghost" className="text-sm text-[#0A1128] hover:bg-gray-50">
                  View All Users
                </Button>
              </div>
            </div>
          </div>

          {/* System Alerts / Actions */}
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#FF6F61] p-8 text-white shadow-lg">
              <h3 className="text-xl font-bold">System Maintenance</h3>
              <p className="mt-2 text-sm text-white/80">
                Scheduled update for database optimization tonight at 2:00 AM UTC.
              </p>
              <Button className="mt-6 w-full bg-white text-[#FF6F61] hover:bg-gray-100">
                Manage Schedule
              </Button>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-bold text-[#0A1128]">Pending Approvals</h3>
              <div className="mt-6 space-y-4">
                {[1, 2].map((_, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-[#0A1128]">Robert Wilson</p>
                      <p className="text-xs text-gray-500">Tutor Application</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="rounded-full bg-green-100 p-2 text-green-700 hover:bg-green-200">
                        <span className="sr-only">Approve</span>
                        ✅
                      </button>
                      <button className="rounded-full bg-red-100 p-2 text-red-700 hover:bg-red-200">
                        <span className="sr-only">Decline</span>
                        ❌
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
