import { useCallback, useEffect, useState } from "react";
import { toast } from "#/lib/toast";
import {
  getAdminUserDetailFn,
  listInstitutionModulesFn,
  type AdminUserDetailDTO,
  type InstitutionModuleOptionDTO,
} from "#/server-actions/admin-users";
import type { UserRole } from "#/lib/user-role";

export function useAdminUserDetailSheet({
  userId,
  open,
  onOpenChange,
  onActionComplete,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}) {
  const [detail, setDetail] = useState<AdminUserDetailDTO | null>(null);
  const [modules, setModules] = useState<InstitutionModuleOptionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [role, setRole] = useState<UserRole>("TUTOR");
  const [moduleId, setModuleId] = useState("");

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [userDetail, modList] = await Promise.all([
        getAdminUserDetailFn({ data: { userId } }),
        listInstitutionModulesFn(),
      ]);
      setDetail(userDetail);
      setModules(modList.modules);
      setRole(userDetail.user.role);
      setNote("");
      setModuleId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user");
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  }, [userId, onOpenChange]);

  useEffect(() => {
    if (open && userId) {
      void load();
    } else {
      setDetail(null);
    }
  }, [open, userId, load]);

  const run = useCallback(
    async (fn: () => Promise<unknown>, success: string) => {
      setSubmitting(true);
      try {
        await fn();
        toast.success(success);
        onActionComplete();
        if (userId) await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      } finally {
        setSubmitting(false);
      }
    },
    [load, onActionComplete, userId],
  );

  return {
    detail,
    modules,
    loading,
    submitting,
    note,
    setNote,
    role,
    setRole,
    moduleId,
    setModuleId,
    load,
    run,
  } as const;
}
