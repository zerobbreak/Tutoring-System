/** Allow only absolute http(s) links in dynamic `href` attributes (blocks javascript:, data:, etc.). */
export function safeExternalHref(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}
