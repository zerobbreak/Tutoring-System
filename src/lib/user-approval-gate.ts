import { supabase } from "#/lib/supabase";
import { isUserFullyApproved } from "#/lib/onboarding-documents";

/**
 * Returns false when the user must stay on settings until onboarding is approved.
 */
export async function fetchUserApprovalAllowed(): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return true;

  const { data, error } = await supabase
    .from("users")
    .select("approval_status")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return true;

  return isUserFullyApproved(data.approval_status as string);
}
