import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSupabaseAdmin } from "#/lib/supabase-admin";
import { runSessionAutomationJobs } from "./run-jobs";

const cronSchema = z.object({
  secret: z.string().min(1),
});

function assertCronSecret(secret: string): void {
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    throw new Error("Unauthorized");
  }
}

export const runSessionAutomationCronFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => cronSchema.parse(input))
  .handler(async ({ data }) => {
    assertCronSecret(data.secret);
    const db = getSupabaseAdmin();
    if (!db) {
      throw new Error("Supabase admin client is not configured.");
    }
    return runSessionAutomationJobs(db);
  });

export { runSessionAutomationJobs, repairPublishedSeries } from "./run-jobs";
