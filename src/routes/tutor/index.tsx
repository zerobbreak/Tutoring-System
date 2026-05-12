import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Button } from "../../components/ui/button";

export const Route = createFileRoute("/tutor/")({
  component: TutorDashboard,
});

function TutorDashboard() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.user_metadata.role !== "tutor") {
        navigate({ to: "/auth/login" });
        return;
      }
      setUser(user);
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
    { label: "Total Students", value: "12", icon: "👥" },
    { label: "Sessions This Week", value: "8", icon: "📅" },
    { label: "Hours Taught", value: "45", icon: "⏱️" },
    { label: "Average Rating", value: "4.9", icon: "⭐" },
  ];

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-8 lg:p-12">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="font-serif text-4xl font-bold text-[#0A1128]">
              Tutor Dashboard
            </h1>
            <p className="mt-2 text-gray-500">
              Welcome back, {user.user_metadata.full_name || user.email}. Ready for today's sessions?
            </p>
          </div>
          <Button className="bg-[#FF6F61] text-white hover:bg-[#FF6F61]/90">
            Create New Session
          </Button>
        </header>

        {/* Stats Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-md hover:ring-[#FF6F61]/20"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold text-[#0A1128]">
                    {stat.value}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-50 text-2xl group-hover:bg-[#FF6F61]/10">
                  {stat.icon}
                </div>
              </div>
              <div className="absolute bottom-0 left-0 h-1 w-0 bg-[#FF6F61] transition-all group-hover:w-full" />
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {/* Upcoming Sessions */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <h2 className="font-serif text-2xl font-bold text-[#0A1128]">
                Upcoming Sessions
              </h2>
              <div className="mt-6 space-y-4">
                {[1, 2, 3].map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl border border-gray-50 p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 flex-col items-center justify-center rounded-lg bg-[#0A1128] text-white">
                        <span className="text-xs font-bold uppercase">May</span>
                        <span className="text-lg font-bold">{15 + i}</span>
                      </div>
                      <div>
                        <p className="font-bold text-[#0A1128]">Advanced Calculus</p>
                        <p className="text-sm text-gray-500">Student: Alex Johnson • 2:00 PM</p>
                      </div>
                    </div>
                    <Button variant="outline" className="border-[#0A1128] text-[#0A1128] hover:bg-[#0A1128] hover:text-white">
                      Details
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions / Notifications */}
          <div className="space-y-8">
            <div className="rounded-2xl bg-[#0A1128] p-8 text-white shadow-lg">
              <h3 className="text-xl font-bold">Need Help?</h3>
              <p className="mt-2 text-sm text-gray-400">
                Check out our resource center for teaching tips and system guides.
              </p>
              <Button className="mt-6 w-full bg-white text-[#0A1128] hover:bg-gray-100">
                Go to Resources
              </Button>
            </div>

            <div className="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
              <h3 className="font-bold text-[#0A1128]">Recent Activity</h3>
              <div className="mt-4 space-y-4">
                <div className="flex gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-green-500" />
                  <p className="text-sm text-gray-600">
                    <span className="font-medium text-[#0A1128]">Sarah Miller</span> submitted a feedback form.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="h-2 w-2 mt-2 rounded-full bg-blue-500" />
                  <p className="text-sm text-gray-600">
                    Session <span className="font-medium text-[#0A1128]">Quantum Physics</span> scheduled for tomorrow.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
