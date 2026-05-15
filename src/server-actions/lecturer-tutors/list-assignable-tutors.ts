import { createServerFn } from "@tanstack/react-start";
import { requireLecturerId } from "#/lib/lecturer-server";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerInstitutionId } from "./require-lecturer-institution";
import type { AssignableTutorDTO } from "./types";

export const listAssignableTutorsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AssignableTutorDTO[]> => {
    const supabase = createSupabaseServerClient();
    const lecturerId = await requireLecturerId(supabase);
    const institutionId = await requireLecturerInstitutionId(
      supabase,
      lecturerId,
    );

    const admin = getSupabaseAdmin();
    const db = admin ?? supabase;

    const { data, error } = await db
      .from("users")
      .select("id, full_name, email")
      .eq("role", "TUTOR")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("full_name");

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      fullName: row.full_name as string,
      email: row.email as string,
    }));
  },
);
