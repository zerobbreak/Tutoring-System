import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "#/lib/query-keys";
import {
  getVenueUnlockAccessFn,
  getVenueUnlockBoardFn,
} from "#/server-actions/venue-unlock";

type UseLecturerRoomAccessDataOptions = {
  enabled: boolean;
  from: string;
  to: string;
};

export function useLecturerRoomAccessData({
  enabled,
  from,
  to,
}: UseLecturerRoomAccessDataOptions) {
  const queryClient = useQueryClient();

  const accessQuery = useQuery({
    queryKey: queryKeys.lecturer.roomAccessAccess,
    queryFn: () => getVenueUnlockAccessFn(),
    enabled,
  });

  const boardQuery = useQuery({
    queryKey: queryKeys.lecturer.roomAccess({ from, to }),
    queryFn: () => getVenueUnlockBoardFn({ data: { from, to } }),
    enabled: enabled && (accessQuery.data?.canAccess ?? false),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.lecturer.roomAccess({ from, to }),
    });
  };

  return {
    access: accessQuery.data,
    items: boardQuery.data?.items ?? [],
    isLoading: accessQuery.isLoading || boardQuery.isLoading,
    isFetching: accessQuery.isFetching || boardQuery.isFetching,
    isSuccess: accessQuery.isSuccess,
    error: accessQuery.error ?? boardQuery.error,
    refetch: async () => {
      await accessQuery.refetch();
      await boardQuery.refetch();
    },
    invalidate,
  };
}
