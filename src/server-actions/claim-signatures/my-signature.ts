import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "#/server-actions/settings/require-user";

export const SIGNATURE_DATA_URL_PREFIX = "data:image/png;base64,";
export const SIGNATURE_MAX_LENGTH = 200_000;

export type MySignatureDTO = {
  imageDataUrl: string;
  updatedAt: string;
} | null;

/** The signed-in user's saved signature, or null when none has been drawn. */
export const getMySignatureFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MySignatureDTO> => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const { data, error } = await supabase
      .from("user_signatures")
      .select("image_data_url, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      imageDataUrl: data.image_data_url as string,
      updatedAt: data.updated_at as string,
    };
  },
);

const saveSchema = z.object({
  imageDataUrl: z
    .string()
    .startsWith(SIGNATURE_DATA_URL_PREFIX, "Signature must be a PNG image.")
    .max(SIGNATURE_MAX_LENGTH, "Signature image is too large.")
    .refine(
      (v) => /^[A-Za-z0-9+/]+=*$/.test(v.slice(SIGNATURE_DATA_URL_PREFIX.length)),
      "Signature image is not valid base64.",
    ),
});

/** Save (or replace) the signed-in user's signature. Past claim signatures keep their own copy. */
export const saveMySignatureFn = createServerFn({ method: "POST" })
  .validator((input: unknown) => saveSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);
    const { error } = await supabase
      .from("user_signatures")
      .upsert(
        { user_id: userId, image_data_url: data.imageDataUrl },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
