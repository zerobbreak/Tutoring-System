import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdminContext } from "#/lib/admin-server";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { ADMIN_USER_CATEGORIES, type AdminUserRowDTO } from "./types";

const listSchema = z.object({
  category: z.enum(ADMIN_USER_CATEGORIES).optional(),
  search: z.string().max(200).optional(),
});

export const listAdminUsersFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => listSchema.parse(input ?? {}))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const { institutionId } = await requireAdminContext(supabase);

    const category = data?.category ?? "all";
    const search = data?.search?.trim();

    let query = supabase
      .from("users")
      .select(
        "id, full_name, email, role, institution_id, last_login_at, user_status, onboarding_step, approval_status, mfa_enabled, is_active, can_unlock_venues, created_at, institutions(name)",
      )
      .eq("institution_id", institutionId)
      .order("full_name", { ascending: true });

    switch (category) {
      case "tutors":
        query = query.eq("role", "TUTOR").eq("user_status", "ACTIVE");
        break;
      case "lecturers":
        query = query.eq("role", "LECTURER").eq("user_status", "ACTIVE");
        break;
      case "admins":
        query = query.in("role", ["ADMIN", "SUPER_ADMIN"]);
        break;
      case "pending":
        query = query.eq("user_status", "PENDING_APPROVAL");
        break;
      case "disabled":
        query = query.in("user_status", ["SUSPENDED", "REJECTED"]);
        break;
      default:
        break;
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const users: AdminUserRowDTO[] = (rows ?? []).map((row) => {
      const inst = row.institutions as { name: string } | { name: string }[] | null;
      const institutionName = Array.isArray(inst)
        ? inst[0]?.name ?? null
        : inst?.name ?? null;

      return {
        id: row.id as string,
        full_name: row.full_name as string,
        email: row.email as string,
        role: row.role as AdminUserRowDTO["role"],
        institution_id: row.institution_id as string | null,
        institution_name: institutionName,
        last_login_at: row.last_login_at as string | null,
        user_status: row.user_status as string,
        onboarding_step: (row.onboarding_step as string | null) ?? null,
        approval_status: row.approval_status as string,
        mfa_enabled: Boolean(row.mfa_enabled),
        can_unlock_venues: Boolean(row.can_unlock_venues ?? false),
        is_active: Boolean(row.is_active),
        created_at: row.created_at as string,
      };
    });

    return { users };
  });
