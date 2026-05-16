import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
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
import { Switch } from "#/components/ui/switch";
import { toast } from "#/lib/toast";
import {
  PLAN_TIERS,
  updateInstitutionProfileFn,
  type InstitutionProfileDTO,
  type PlanTier,
} from "#/server-actions/admin-institutions";

const selectContentProps = {
  position: "popper" as const,
  sideOffset: 4,
  className: "z-[100]",
};

type InstitutionProfileCardProps = {
  institution: InstitutionProfileDTO | null;
  booting: boolean;
  onUpdated: () => void;
};

export function InstitutionProfileCard({
  institution,
  booting,
  onUpdated,
}: InstitutionProfileCardProps) {
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [country, setCountry] = useState("");
  const [planTier, setPlanTier] = useState<PlanTier | "">("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!institution) return;
    setName(institution.name);
    setDomain(institution.domain ?? "");
    setCountry(institution.country ?? "");
    setPlanTier(
      institution.plan_tier &&
        PLAN_TIERS.includes(institution.plan_tier as PlanTier)
        ? (institution.plan_tier as PlanTier)
        : "",
    );
    setIsActive(institution.is_active);
  }, [institution]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Institution name is required.");
      return;
    }
    setSaving(true);
    try {
      await updateInstitutionProfileFn({
        data: {
          name: name.trim(),
          domain: domain.trim() || null,
          country: country.trim() || null,
          plan_tier: planTier || null,
          is_active: isActive,
        },
      });
      toast.success("Institution profile updated.");
      onUpdated();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="size-4 text-muted-foreground" />
          Institution profile
        </CardTitle>
        <CardDescription>
          Configure your institution&apos;s identity and plan tier
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {booting || !institution ? (
          <p className="text-sm text-muted-foreground">Loading profile…</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="inst-name">Name</Label>
                <Input
                  id="inst-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inst-domain">Domain</Label>
                <Input
                  id="inst-domain"
                  placeholder="university.edu"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inst-country">Country</Label>
                <Input
                  id="inst-country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Plan tier</Label>
                <Select
                  value={planTier || "none"}
                  onValueChange={(v) =>
                    setPlanTier(v === "none" ? "" : (v as PlanTier))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select plan" />
                  </SelectTrigger>
                  <SelectContent {...selectContentProps}>
                    <SelectItem value="none">Not set</SelectItem>
                    {PLAN_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier}>
                        {tier.charAt(0).toUpperCase() + tier.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
              <div className="space-y-0.5">
                <Label htmlFor="inst-active">Institution active</Label>
                <p className="text-sm text-muted-foreground">
                  Deactivating may prevent new users from selecting this
                  institution during onboarding.
                </p>
              </div>
              <Switch
                id="inst-active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>

            <Button disabled={saving} onClick={() => void handleSave()}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
