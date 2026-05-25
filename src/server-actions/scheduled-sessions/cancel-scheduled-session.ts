import { createServerFn } from "@tanstack/react-start";
import { requireAdminContext, resolveAdminWriteClient } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { assertModuleInInstitution } from "#/server-actions/admin-schedules/helpers";
import {
  cancelScheduledSessionRecord,
  fetchManagedSession,
} from "./session-lifecycle";
import { sessionActionSchema } from "./schemas";

export const adminCancelScheduledSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sessionActionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const { userId, institutionId } = await requireAdminContext(supabase);
    const session = await fetchManagedSession(supabase, data.sessionId);
    await assertModuleInInstitution(supabase, session.module_id, institutionId);
    const writeDb = resolveAdminWriteClient(supabase);
    await cancelScheduledSessionRecord(writeDb, {
      sessionId: data.sessionId,
      actorId: userId,
      reason: data.reason,
      institutionId,
    });
    return { ok: true };
  });

export const tutorCancelScheduledSessionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sessionActionSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const supabase = createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    const session = await fetchManagedSession(supabase, data.sessionId);
    if (session.tutor_id !== user.id) {
      throw new Error("You can only cancel your own sessions.");
    }

    await cancelScheduledSessionRecord(supabase, {
      sessionId: data.sessionId,
      actorId: user.id,
      reason: data.reason,
    });
    return { ok: true };
  });
