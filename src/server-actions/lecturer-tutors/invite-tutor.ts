import { createServerFn } from "@tanstack/react-start";
import { format } from "date-fns";
import { z } from "zod";
import { requireLecturerId } from "#/lib/lecturer-server";
import { provisionInstitutionUser } from "#/lib/provision-institution-user";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireLecturerInstitutionId } from "./require-lecturer-institution";

const inviteSchema = z.object({
  moduleId: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string().min(2).max(255),
  temporaryPassword: z.string().min(8).max(72).optional(),
});

export const inviteTutorToModuleFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inviteSchema.parse(input))
  .handler(
    async ({
      data,
    }): Promise<{ tutorId: string; assignmentId: string; created: boolean }> => {
      const supabase = createSupabaseServerClient();
      const lecturerId = await requireLecturerId(supabase);
      const institutionId = await requireLecturerInstitutionId(
        supabase,
        lecturerId,
      );

      const admin = getSupabaseAdmin();
      if (!admin) {
        throw new Error(
          "Tutor accounts cannot be created: SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
        );
      }

      const { data: mod, error: modErr } = await supabase
        .from("modules")
        .select("id")
        .eq("id", data.moduleId)
        .eq("lecturer_id", lecturerId)
        .maybeSingle();

      if (modErr) throw new Error(modErr.message);
      if (!mod) throw new Error("Module not found or access denied.");

      const email = data.email.trim().toLowerCase();

      const { userId: tutorId, created } = await provisionInstitutionUser(
        admin,
        {
          email,
          fullName: data.fullName.trim(),
          role: "TUTOR",
          institutionId,
          temporaryPassword: data.temporaryPassword,
        },
      );

      const startDate = format(new Date(), "yyyy-MM-dd");

      const { data: existingAssign } = await admin
        .from("tutor_assignments")
        .select("id, is_active")
        .eq("module_id", data.moduleId)
        .eq("tutor_id", tutorId)
        .maybeSingle();

      if (existingAssign?.id) {
        if (!existingAssign.is_active) {
          const { error: reactivateErr } = await admin
            .from("tutor_assignments")
            .update({
              is_active: true,
              start_date: startDate,
              end_date: null,
            })
            .eq("id", existingAssign.id as string);

          if (reactivateErr) throw new Error(reactivateErr.message);
        }
        return {
          tutorId,
          assignmentId: existingAssign.id as string,
          created,
        };
      }

      const { data: inserted, error: assignErr } = await admin
        .from("tutor_assignments")
        .insert({
          module_id: data.moduleId,
          tutor_id: tutorId,
          start_date: startDate,
          end_date: null,
          is_active: true,
        })
        .select("id")
        .single();

      if (assignErr) throw new Error(assignErr.message);

      return {
        tutorId,
        assignmentId: inserted.id as string,
        created,
      };
    },
  );
