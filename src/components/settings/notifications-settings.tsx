import { useState } from "react";
import { Bell, Calendar, LayoutDashboard, Loader2 } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { toast } from "#/lib/toast";
import type {
  SettingsProfileDTO,
  UserPreferencesDTO,
} from "#/server-actions/settings";
import { updateUserPreferencesFn } from "#/server-actions/settings";
import { SettingsPreferenceRow } from "./settings-preference-row";

const DASHBOARD_PREFS_KEY = "tutor-dashboard-prefs";

type NotificationsSettingsProps = {
  profile: SettingsProfileDTO;
  onProfileChange: (profile: SettingsProfileDTO) => void;
};

export function NotificationsSettings({
  profile,
  onProfileChange,
}: NotificationsSettingsProps) {
  const [prefs, setPrefs] = useState<UserPreferencesDTO>(profile.preferences);
  const [saving, setSaving] = useState(false);

  const persistLocalDashboard = (next: UserPreferencesDTO) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      DASHBOARD_PREFS_KEY,
      JSON.stringify({
        showStats: next.dashboard_show_stats,
        showNotifications: next.dashboard_show_notifications,
        compactMode: next.dashboard_compact_mode,
      }),
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateUserPreferencesFn({ data: prefs });
      persistLocalDashboard(prefs);
      onProfileChange({ ...profile, preferences: prefs });
      toast.success("Notification preferences saved.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save preferences.",
      );
    } finally {
      setSaving(false);
    }
  };

  const patch = (partial: Partial<UserPreferencesDTO>) => {
    setPrefs((p) => ({ ...p, ...partial }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-4 text-[var(--lagoon)]" />
            Notifications
          </CardTitle>
          <CardDescription>
            Choose how you receive updates about sessions, claims, and messages.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingsPreferenceRow
            id="email-notifications"
            label="Email notifications"
            description="Session reminders, claim updates, and system alerts."
            checked={prefs.email_notifications}
            onCheckedChange={(v) => patch({ email_notifications: v })}
          />
          <SettingsPreferenceRow
            id="push-notifications"
            label="Push notifications"
            description="Browser push when supported (requires permission)."
            checked={prefs.push_notifications}
            onCheckedChange={(v) => patch({ push_notifications: v })}
          />
          <div className="rounded-lg border border-border/60 bg-white px-4 py-3">
            <Label className="text-[#0A1128]">Reminder frequency</Label>
            <p className="mb-2 text-sm text-muted-foreground">
              How often to bundle non-urgent reminders.
            </p>
            <Select
              value={prefs.reminder_frequency}
              onValueChange={(v) =>
                patch({
                  reminder_frequency: v as UserPreferencesDTO["reminder_frequency"],
                })
              }
            >
              <SelectTrigger className="max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="daily">Daily digest</SelectItem>
                <SelectItem value="weekly">Weekly digest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-4 text-[var(--lagoon)]" />
            Calendar preferences
          </CardTitle>
          <CardDescription>
            Defaults for schedule and session views.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 rounded-lg border border-border/60 bg-white px-4 py-3">
            <Label>Week starts on</Label>
            <Select
              value={String(prefs.calendar_week_start)}
              onValueChange={(v) =>
                patch({
                  calendar_week_start: Number(v) as 0 | 1,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 rounded-lg border border-border/60 bg-white px-4 py-3">
            <Label>Default view</Label>
            <Select
              value={prefs.calendar_default_view}
              onValueChange={(v) =>
                patch({
                  calendar_default_view:
                    v as UserPreferencesDTO["calendar_default_view"],
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LayoutDashboard className="size-4 text-[var(--lagoon)]" />
            Dashboard customization
          </CardTitle>
          <CardDescription>
            Control what appears on your home dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <SettingsPreferenceRow
            id="dash-stats"
            label="Show statistics"
            description="Hours, claims, and summary metrics."
            checked={prefs.dashboard_show_stats}
            onCheckedChange={(v) => patch({ dashboard_show_stats: v })}
          />
          <SettingsPreferenceRow
            id="dash-notifications"
            label="Show notifications panel"
            description="Recent alerts on the dashboard."
            checked={prefs.dashboard_show_notifications}
            onCheckedChange={(v) =>
              patch({ dashboard_show_notifications: v })
            }
          />
          <SettingsPreferenceRow
            id="dash-compact"
            label="Compact layout"
            description="Denser cards with less whitespace."
            checked={prefs.dashboard_compact_mode}
            onCheckedChange={(v) => patch({ dashboard_compact_mode: v })}
          />
        </CardContent>
      </Card>

      <Button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon-deep)]"
      >
        {saving ? (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Saving…
          </>
        ) : (
          "Save notification preferences"
        )}
      </Button>
    </div>
  );
}
