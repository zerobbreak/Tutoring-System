import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertTargetUserInInstitution } from "./assert-target-user";

const schema = z.object({
  moduleId: z.string().uuid(),
  lecturerUserId: z.string().uuid(),
});

export const assignModuleLecturerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const ctx = await requireAdminContext(supabase);

    const lecturer = await assertTargetUserInInstitution(
      supabase,
      ctx,
      data.lecturerUserId,
    );

    if (lecturer.role !== "LECTURER") {
      throw new Error("Selected user must have the lecturer role.");
    }

    const { data: mod, error: modErr } = await supabase
      .from("modules")
      .select("id")
      .eq("id", data.moduleId)
      .eq("institution_id", ctx.institutionId)
      .maybeSingle();

    if (modErr) throw new Error(modErr.message);
    if (!mod) throw new Error("Module not found in your institution.");

    const { error: updErr } = await supabase
      .from("modules")
      .update({ lecturer_id: data.lecturerUserId })
      .eq("id", data.moduleId)
      .eq("institution_id", ctx.institutionId);

    if (updErr) throw new Error(updErr.message);

    return { ok: true as const };
  });
