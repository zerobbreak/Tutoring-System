const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/** Public Supabase URL (browser + server). */
export function getSupabaseUrl(): string {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (isValidUrl(supabaseUrl) && supabaseUrl !== "your-supabase-url") {
    return supabaseUrl;
  }
  return "https://placeholder.supabase.co";
}

/** Public anon key (browser + server). */
export function getSupabaseAnonKey(): string {
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (key && key !== "your-supabase-anon-key") {
    return key;
  }
  return "placeholder-key";
}
