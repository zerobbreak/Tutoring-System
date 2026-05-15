import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { VERIFICATION_CLAIM_SELECT } from "./constants";
import { loadClaimCounts } from "./load-claim-counts";
import { mapClaimCardRow } from "./map-claim-card";
import { unwrapOne } from "./unwrap";
import type {
  ScheduleComparisonDTO,
  VerificationClaimDetailDTO,
  VerificationEvidenceDTO,
  VerificationTimelineItemDTO,
} from "./types";

const BUCKET = "attendance_registers";

const claimIdSchema = z.object({
  claimId: z.string().uuid(),
});

export const getVerificationClaimFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => claimIdSchema.parse(input))
  .handler(async ({ data }): Promise<VerificationClaimDetailDTO> => {
    const supabase = createSupabaseServerClient();
    await requireLecturerId(supabase);

    const { data: claimRow, error: cErr } = await supabase
      .from("session_claims")
      .select(VERIFICATION_CLAIM_SELECT)
      .eq("id", data.claimId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claimRow) throw new Error("Claim not found.");

    const { evidenceCountByClaim, scanCountByClaim } = await loadClaimCounts(
      supabase,
      [data.claimId],
    );

    const card = mapClaimCardRow(
      claimRow as Parameters<typeof mapClaimCardRow>[0],
      evidenceCountByClaim.get(data.claimId) ?? 0,
      scanCountByClaim.get(data.claimId) ?? 0,
    );

    const { data: evRows, error: evErr } = await supabase
      .from("attendance_evidence")
      .select("id, file_url, original_filename, uploaded_at")
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (evErr) throw new Error(evErr.message);

    const evidence: VerificationEvidenceDTO[] = [];
    for (const r of evRows ?? []) {
      let file_url = r.file_url as string;
      if (file_url.startsWith(`${BUCKET}/`)) {
        const path = file_url.slice(BUCKET.length + 1);
        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 3600);
        if (signed?.signedUrl) file_url = signed.signedUrl;
      }
      evidence.push({
        id: r.id as string,
        file_name: r.original_filename as string,
        file_url,
        uploaded_at: (r.uploaded_at as string) || new Date().toISOString(),
      });
    }

    const { data: historyRows, error: hErr } = await supabase
      .from("verification_actions")
      .select(
        `
        id,
        action_type,
        from_status,
        to_status,
        comment,
        acted_at,
        mfa_confirmed,
        actor:users ( full_name, email )
      `,
      )
      .eq("claim_id", data.claimId)
      .order("acted_at", { ascending: false });

    if (hErr) throw new Error(hErr.message);

    const timeline: VerificationTimelineItemDTO[] = (historyRows ?? []).map(
      (r) => {
        const actor = unwrapOne(
          r.actor as
            | { full_name: string; email: string }
            | { full_name: string; email: string }[]
            | null,
        );
        return {
          id: r.id as string,
          action_type: r.action_type as string,
          from_status: r.from_status,
          to_status: r.to_status,
          comment: r.comment as string | null,
          acted_at: r.acted_at as string,
          digitally_signed: Boolean(r.mfa_confirmed),
          actor,
        };
      },
    );

    const { data: disputeRow } = await supabase
      .from("disputes")
      .select("id, reason, raised_at")
      .eq("claim_id", data.claimId)
      .eq("status", "OPEN")
      .maybeSingle();

    const present = card.attendance_present_count;
    const scans = card.attendance_scan_count;
    const headcountMatchesScans =
      present != null ? present === scans : null;

    const schedule_comparison: ScheduleComparisonDTO = {
      claim_date: card.session_date,
      claim_start: card.start_time,
      claim_end: card.end_time,
      claim_venue: card.venue,
      claim_hours: card.hours,
      linked_from_schedule: Boolean(
        (claimRow as { source_schedule_import_id?: string | null })
          .source_schedule_import_id,
      ),
      attendance_present: present,
      attendance_expected: card.attendance_expected_count,
      attendance_scan_count: scans,
      headcount_matches_scans: headcountMatchesScans,
    };

    const raw = claimRow as {
      notes: string | null;
      topics_covered: string | null;
      session_kind: string | null;
    };

    return {
      ...card,
      notes: raw.notes,
      topics_covered: raw.topics_covered,
      session_kind: raw.session_kind,
      evidence,
      timeline,
      schedule_comparison,
      open_dispute: disputeRow
        ? {
            id: disputeRow.id as string,
            reason: disputeRow.reason as string,
            raised_at: disputeRow.raised_at as string,
          }
        : null,
    };
  });
