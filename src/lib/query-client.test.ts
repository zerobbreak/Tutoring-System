import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { resetQueryCache } from "#/lib/query-client";

describe("resetQueryCache", () => {
  it("keeps cached data while refreshing queries after auth changes", () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    queryClient.setQueryData(["auth", "profile"], { name: "Ada" });

    expect(() => resetQueryCache(queryClient)).not.toThrow();
    expect(queryClient.getQueryData(["auth", "profile"])).toEqual({
      name: "Ada",
    });
  });
});
