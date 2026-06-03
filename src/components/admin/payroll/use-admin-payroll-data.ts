import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  getPayrollSummaryFn,
  listPayrollExportsFn,
} from "#/server-actions/admin-payroll";

export function useAdminPayrollData(enabled = true) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.admin.payroll,
    queryFn: async () => {
      const [summary, exportsRes] = await Promise.all([
        getPayrollSummaryFn(),
        listPayrollExportsFn(),
      ]);
      return { summary, exports: exportsRes.exports };
    },
    enabled,
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.payroll });

  return { ...query, invalidate };
}
