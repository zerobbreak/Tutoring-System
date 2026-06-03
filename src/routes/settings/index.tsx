import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bell, Shield, User } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountSettings } from "#/components/settings/account-settings";
import { OnboardingDocumentsCard } from "#/components/settings/onboarding-documents-card";
import { NotificationsSettings } from "#/components/settings/notifications-settings";
import { SecuritySettings } from "#/components/settings/security-settings";
import {
  PageLoadingSpinner,
  QueryBlockingState,
} from "#/components/ui/query-fetch-feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { APP_PATHS } from "#/lib/app-paths";
import { formatQueryError } from "#/lib/query-error";
import { queryKeys } from "#/lib/query-keys";
import { getPostAuthDashboardPath, getUserRole } from "#/lib/user-role";
import {
  getSettingsProfileFn,
  type SettingsProfileDTO,
} from "#/server-actions/settings";
import { Route as RootRoute } from "../__root";

export const Route = createFileRoute("/settings/")({
  loader: async ({ context: { queryClient } }) => {
    try {
      const profile = await getSettingsProfileFn();
      queryClient.setQueryData(queryKeys.settings.profile, profile);
      return { profile };
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

  const role = getUserRole(sessionData?.user);
  const dashboardPath = getPostAuthDashboardPath(role);

  useEffect(() => {
    if (!sessionData?.user) {
      navigate({ to: APP_PATHS.auth.login });
    }
  }, [sessionData, navigate]);

  const {
    data: queryProfile,
    isLoading,
    isFetching,
    isSuccess,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.settings.profile,
    queryFn: () => getSettingsProfileFn(),
    enabled: !!sessionData?.user,
    initialData: loaderProfile ?? undefined,
  });

  const [profile, setProfile] = useState<SettingsProfileDTO | null>(
    loaderProfile,
  );

  useEffect(() => {
    if (queryProfile) {
      setProfile(queryProfile);
    }
  }, [queryProfile]);

  if (!sessionData?.user) {
    return <PageLoadingSpinner className="min-h-[60vh] bg-background" />;
  }

  if (isLoading && !profile) {
    return <PageLoadingSpinner className="min-h-[60vh] bg-background" label="Loading settings…" />;
  }

  const loadError = formatQueryError(error);
  if (loadError && !profile) {
    return (
      <div className="min-h-[60vh] bg-background">
        <QueryBlockingState
          title="Could not load settings"
          message={loadError}
          onRetry={() => void refetch()}
          retrying={isFetching}
        />
      </div>
    );
  }

  if (!profile && !isSuccess) {
    return <PageLoadingSpinner className="min-h-[60vh] bg-background" />;
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10 lg:px-10 lg:py-12">
        <Link
          to={dashboardPath}
          className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[var(--lagoon-deep)]"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>

        <header className="mb-8">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-foreground">
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
              onRefresh={async () => {
                await refetch();
              }}
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
