import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "../../components/ui/avatar";
import { updateProfileServerFn } from "../../lib/auth-server";
import { formatRoleLabel } from "../../lib/user-role";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/settings/")({
  component: SettingsPage,
});

function SettingsPage() {
  const { sessionData } = RootRoute.useLoaderData();
  const [updating, setUpdating] = useState(false);
  const [fullName, setFullName] = useState(
    sessionData?.user?.user_metadata?.full_name || "",
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionData?.user) {
      navigate({ to: "/auth/login" });
    }
  }, [sessionData, navigate]);

  const user = sessionData?.user;
  const loading = !user;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setMessage(null);

    try {
      await updateProfileServerFn({
        data: { fullName },
      });
      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile.",
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon)] border-t-transparent" />
      </div>
    );
  }

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
    : user.email?.[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-8 lg:p-12">
      <div className="mx-auto max-w-3xl">
        <header className="mb-12">
          <h1 className="font-serif text-4xl font-bold text-[#0A1128]">
            Settings
          </h1>
          <p className="mt-2 text-gray-500">
            Manage your account preferences and profile information.
          </p>
        </header>

        <div className="space-y-8">
          {/* Profile Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your personal information visible to others.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  {user.user_metadata?.avatar_url ? (
                    <AvatarImage src={user.user_metadata.avatar_url} />
                  ) : (
                    <AvatarFallback className="text-2xl">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>
                <Button variant="outline" className="text-sm">
                  Change Avatar
                </Button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                {message && (
                  <p
                    className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-600"}`}
                  >
                    {message.text}
                  </p>
                )}
                <Button
                  type="submit"
                  disabled={updating}
                  className="bg-[var(--lagoon)] hover:bg-[var(--lagoon-deep)] text-white"
                >
                  {updating ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Account Section */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your account details and role within the system.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-gray-500">Email Address</Label>
                <p className="text-[#0A1128] font-medium">{user.email}</p>
              </div>
              <div className="grid gap-2">
                <Label className="text-gray-500">Role</Label>
                <div className="flex">
                  <span className="rounded-full bg-[var(--lagoon)]/10 px-3 py-1 text-xs font-bold uppercase text-[var(--lagoon-deep)]">
                    {formatRoleLabel(user.user_metadata?.role)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-red-100 bg-red-50/30">
            <CardHeader>
              <CardTitle className="text-red-700">Danger Zone</CardTitle>
              <CardDescription>
                Permanently delete your account and all associated data.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="destructive">Delete Account</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
