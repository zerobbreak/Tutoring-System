import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ATTENDANCE_REGISTER_BUCKET } from "#/server-actions/tutor-sessions/constants";
import { requireUserId } from "#/server-actions/tutor-sessions/helpers";
import { signAttendanceEvidenceUrl } from "#/server-actions/tutor-sessions/mappers";
import type { AttendanceEvidenceRow } from "#/server-actions/tutor-sessions/types";

const listEvidenceSchema = z.object({
  claimId: z.string().uuid(),
});

const uploadEvidenceSchema = z.object({
  claimId: z.string().uuid(),
  fileBase64: z.string().min(1),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
});

/** Evidence rows for a claim, with short-lived signed URLs when possible. */
export const listAttendanceEvidenceFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => listEvidenceSchema.parse(input))
  .handler(async ({ data }): Promise<AttendanceEvidenceRow[]> => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    const { data: rows, error } = await supabase
      .from("attendance_evidence")
      .select(
        "id, file_url, file_type, original_filename, file_size_bytes, uploaded_at",
      )
      .eq("claim_id", data.claimId)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(error.message);

    const out: AttendanceEvidenceRow[] = [];
    for (const r of rows ?? []) {
      const url = r.file_url as string;
      const signedUrl = await signAttendanceEvidenceUrl(supabase, url);
      out.push({
        id: r.id as string,
        file_url: url,
        file_type: r.file_type as string,
        original_filename: r.original_filename as string,
        file_size_bytes: r.file_size_bytes as number | null,
        uploaded_at: r.uploaded_at as string | null,
        signedUrl,
      });
    }
    return out;
  });

/** Upload register file to storage and insert attendance_evidence. */
export const registerAttendanceEvidenceFn = createServerFn({
  method: "POST",
})
  .validator((input: unknown) => uploadEvidenceSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const tutorId = await requireUserId(supabase);

    const buf = Buffer.from(data.fileBase64, "base64");
    if (buf.byteLength > 12 * 1024 * 1024) {
      throw new Error("File too large (max 12MB).");
    }

    const { data: claim, error: cErr } = await supabase
      .from("session_claims")
      .select("id")
      .eq("id", data.claimId)
      .eq("tutor_id", tutorId)
      .maybeSingle();

    if (cErr) throw new Error(cErr.message);
    if (!claim) throw new Error("Session not found.");

    const safeName = data.fileName.replace(/[^\w.\-()+ ]/g, "_").slice(0, 200);
    const objectPath = `${tutorId}/${data.claimId}/${crypto.randomUUID()}_${safeName}`;

    const { error: upErr } = await supabase.storage
      .from(ATTENDANCE_REGISTER_BUCKET)
      .upload(objectPath, buf, {
        contentType: data.mimeType,
        upsert: false,
      });

    if (upErr) throw new Error(upErr.message);

    const storageRef = `${ATTENDANCE_REGISTER_BUCKET}/${objectPath}`;

    const { error: insErr } = await supabase.from("attendance_evidence").insert({
      claim_id: data.claimId,
      file_url: storageRef,
      file_type: data.mimeType,
      original_filename: data.fileName,
      file_size_bytes: buf.byteLength,
    });

    if (insErr) throw new Error(insErr.message);
    return { ok: true as const, file_url: storageRef };
  });
