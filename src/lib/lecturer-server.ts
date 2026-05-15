import type { createSupabaseServerClient } from "#/lib/supabase-server";

export async function requireLecturerId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");

  const role = user.user_metadata?.role as string | undefined;
  if (role !== "LECTURER") {
    throw new Error("Lecturer access required.");
  }
  return user.id;
}
