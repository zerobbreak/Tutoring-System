import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "#/lib/supabase-server";
import { requireUserId } from "./require-user";
import { avatarSchema, uploadAvatarSchema } from "./types";

export const updateAvatarUrlFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => avatarSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    await requireUserId(supabase);

    const { error } = await supabase.auth.updateUser({
      data: { avatar_url: data.avatarUrl },
    });
    if (error) throw new Error(error.message);

    return { success: true };
  });

export const uploadAvatarFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => uploadAvatarSchema.parse(input))
  .handler(async ({ data }) => {
    const supabase = createSupabaseServerClient();
    const userId = await requireUserId(supabase);

    const buf = Buffer.from(data.fileBase64, "base64");
    if (buf.byteLength > 2 * 1024 * 1024) {
      throw new Error("Image must be under 2 MB.");
    }

    const ext = data.extension.replace(/[^\w]/g, "") || "jpg";
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, buf, {
        upsert: true,
        contentType: data.contentType,
      });
    if (uploadError) throw new Error(uploadError.message);

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: authError } = await supabase.auth.updateUser({
      data: { avatar_url: avatarUrl },
    });
    if (authError) throw new Error(authError.message);

    return { success: true, avatarUrl };
  });
