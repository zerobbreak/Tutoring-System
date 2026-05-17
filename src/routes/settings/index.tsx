import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Bell, Shield, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AccountSettings } from "#/components/settings/account-settings";
import { OnboardingDocumentsCard } from "#/components/settings/onboarding-documents-card";
import { NotificationsSettings } from "#/components/settings/notifications-settings";
import { SecuritySettings } from "#/components/settings/security-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { getPostAuthDashboardPath } from "#/lib/user-role";
import {
  getSettingsProfileFn,
  type SettingsProfileDTO,
} from "#/server-actions/settings";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/settings/")({
  loader: async () => {
    try {
      return { profile: await getSettingsProfileFn() };
    } catch {
      return { profile: null };
    }
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { sessionData } = RootRoute.useLoaderData();
  const { profile: loaderProfile } = Route.useLoaderData();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<SettingsProfileDTO | null>(
    loaderProfile,
  );
  const [loading, setLoading] = useState(!loaderProfile);

  const role = sessionData?.user?.user_metadata?.role as string | undefined;
  const dashboardPath = getPostAuthDashboardPath(role);

  useEffect(() => {
    if (!sessionData?.user) {
      navigate({ to: "/auth/login" });
    }
  }, [sessionData, navigate]);

  const refreshProfile = useCallback(async () => {
    try {
      const next = await getSettingsProfileFn();
      setProfile(next);
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    if (!loaderProfile && sessionData?.user) {
      void refreshProfile().finally(() => setLoading(false));
    }
  }, [loaderProfile, sessionData?.user, refreshProfile]);

  if (!sessionData?.user || loading || !profile) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#FDFDFF]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[var(--lagoon)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFF]">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-12">
        <Link
          to={dashboardPath}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[var(--lagoon-deep)]"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#0A1128]">
            Settings
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Personal configuration and account management — profile, security,
            and notifications.
          </p>
        </header>

        <Tabs defaultValue="account" className="gap-6">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/60 p-1">
            <TabsTrigger value="account" className="gap-1.5 px-4">
              <User className="size-4" />
              Account
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 px-4">
              <Shield className="size-4" />
              Security
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 px-4">
              <Bell className="size-4" />
              Notifications
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account" className="space-y-6">
            <OnboardingDocumentsCard />
            <AccountSettings profile={profile} onProfileChange={setProfile} />
          </TabsContent>

          <TabsContent value="security">
            <SecuritySettings
              profile={profile}
              onProfileChange={setProfile}
              onRefresh={refreshProfile}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsSettings
              profile={profile}
              onProfileChange={setProfile}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
