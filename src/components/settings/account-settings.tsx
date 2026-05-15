import { useRef, useState } from "react";
import { Building2, Loader2, Mail, Phone, User } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { supabase } from "#/lib/supabase";
import { toast } from "#/lib/toast";
import { formatRoleLabel } from "#/lib/user-role";
import type { SettingsProfileDTO } from "#/server-actions/settings";
import {
  updateAccountProfileFn,
  updateAvatarUrlFn,
  updateInstitutionFn,
} from "#/server-actions/settings";

type AccountSettingsProps = {
  profile: SettingsProfileDTO;
  onProfileChange: (profile: SettingsProfileDTO) => void;
};

export function AccountSettings({
  profile,
  onProfileChange,
}: AccountSettingsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(profile.full_name);
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [department, setDepartment] = useState(profile.department ?? "");
  const [officeLocation, setOfficeLocation] = useState(
    profile.office_location ?? "",
  );
  const [selectedInstitution, setSelectedInstitution] = useState(
    profile.institution?.id ?? "",
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingInstitution, setSavingInstitution] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile.email[0]?.toUpperCase() ?? "?";

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateAccountProfileFn({
        data: {
          fullName,
          phone: phone || undefined,
          department: department || undefined,
          officeLocation: officeLocation || undefined,
        },
      });
      onProfileChange({
        ...profile,
        full_name: fullName,
        phone: phone || null,
        department: department || null,
        office_location: officeLocation || null,
      });
      toast.success("Profile updated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleInstitutionSave = async () => {
    if (!selectedInstitution) {
      toast.error("Select an institution.");
      return;
    }
    setSavingInstitution(true);
    try {
      await updateInstitutionFn({ data: { institutionId: selectedInstitution } });
      const inst = profile.available_institutions.find(
        (i) => i.id === selectedInstitution,
      );
      onProfileChange({
        ...profile,
        institution: inst ?? profile.institution,
      });
      toast.success("Institution linked to your account.");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update institution.",
      );
    } finally {
      setSavingInstitution(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${profile.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await updateAvatarUrlFn({ data: { avatarUrl } });
      onProfileChange({ ...profile, avatar_url: avatarUrl });
      toast.success("Avatar updated.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload avatar.");
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-4 text-[var(--lagoon)]" />
            Profile
          </CardTitle>
          <CardDescription>
            Your name and photo appear across the tutoring workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-6">
            <Avatar className="h-20 w-20 ring-2 ring-[var(--lagoon)]/20">
              {profile.avatar_url ? (
                <AvatarImage src={profile.avatar_url} alt={fullName} />
              ) : null}
              <AvatarFallback className="bg-[var(--lagoon)]/10 text-xl text-[var(--lagoon-deep)]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
              />
              <Button
                type="button"
                variant="outline"
                disabled={uploadingAvatar}
                onClick={() => fileRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  "Change avatar"
                )}
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or WebP. Max 2 MB.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your display name"
              />
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              className="bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon-deep)]"
            >
              {savingProfile ? "Saving…" : "Save profile"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-[var(--lagoon)]" />
            Institution
          </CardTitle>
          <CardDescription>
            Your campus or organization within the system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.institution ? (
            <div className="rounded-lg border bg-muted/30 px-4 py-3">
              <p className="font-medium text-[#0A1128]">
                {profile.institution.name}
              </p>
              {profile.institution.domain ? (
                <p className="text-sm text-muted-foreground">
                  {profile.institution.domain}
                </p>
              ) : null}
              {profile.institution.country ? (
                <p className="text-sm text-muted-foreground">
                  {profile.institution.country}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                No institution is linked yet. Select yours to unlock
                institution-scoped features.
              </p>
              <Select
                value={selectedInstitution}
                onValueChange={setSelectedInstitution}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select institution" />
                </SelectTrigger>
                <SelectContent>
                  {profile.available_institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                onClick={handleInstitutionSave}
                disabled={savingInstitution || !selectedInstitution}
                className="bg-[var(--lagoon)] text-white hover:bg-[var(--lagoon-deep)]"
              >
                {savingInstitution ? "Saving…" : "Link institution"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4 text-[var(--lagoon)]" />
            Contact details
          </CardTitle>
          <CardDescription>
            How colleagues and students can reach you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label className="text-muted-foreground">Email</Label>
            <p className="font-medium text-[#0A1128]">{profile.email}</p>
            <p className="text-xs text-muted-foreground">
              Email is managed through your account sign-in.
            </p>
          </div>
          <Separator />
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1.5">
                <Phone className="size-3.5" />
                Phone
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 …"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Department / faculty</Label>
              <Input
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="office">Office / location</Label>
              <Input
                id="office"
                value={officeLocation}
                onChange={(e) => setOfficeLocation(e.target.value)}
                placeholder="Building, room, or campus"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-[var(--lagoon)]/10 px-3 py-1 text-xs font-semibold uppercase text-[var(--lagoon-deep)]">
                {formatRoleLabel(profile.role)}
              </span>
            </div>
            <Button
              type="submit"
              disabled={savingProfile}
              variant="outline"
            >
              {savingProfile ? "Saving…" : "Save contact details"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
