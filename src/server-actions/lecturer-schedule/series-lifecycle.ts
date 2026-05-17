import type { createSupabaseServerClient } from "#/lib/supabase-server";

type Supabase = ReturnType<typeof createSupabaseServerClient>;

export async function deleteDraftScheduleSeries(
  supabase: Supabase,
  seriesId: string,
): Promise<void> {
  const { data: series, error: fetchErr } = await supabase
    .from("schedule_series")
    .select("id, status")
    .eq("id", seriesId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  if (series.status !== "DRAFT") {
    throw new Error(
      "Only draft series can be deleted. Archive published series instead.",
    );
  }

  const { error: delErr } = await supabase
    .from("schedule_series")
    .delete()
    .eq("id", seriesId);

  if (delErr) throw new Error(delErr.message);
}

export async function archivePublishedScheduleSeries(
  supabase: Supabase,
  seriesId: string,
): Promise<{ cancelledSessionCount: number }> {
  const { data: series, error: fetchErr } = await supabase
    .from("schedule_series")
    .select("id, status")
    .eq("id", seriesId)
    .single();

  if (fetchErr) throw new Error(fetchErr.message);
  if (series.status === "ARCHIVED") {
    throw new Error("This series is already archived.");
  }
  if (series.status !== "PUBLISHED") {
    throw new Error("Only published series can be archived. Delete drafts instead.");
  }

  const now = new Date().toISOString();
  const { data: cancelled, error: cancelErr } = await supabase
    .from("scheduled_sessions")
    .update({ status: "CANCELLED" })
    .eq("series_id", seriesId)
    .eq("status", "SCHEDULED")
    .gte("starts_at", now)
    .select("id");

  if (cancelErr) throw new Error(cancelErr.message);

  const { error: archErr } = await supabase
    .from("schedule_series")
    .update({ status: "ARCHIVED" })
    .eq("id", seriesId);

  if (archErr) throw new Error(archErr.message);

  return { cancelledSessionCount: cancelled?.length ?? 0 };
}
