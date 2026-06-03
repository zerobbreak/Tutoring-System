/** Normalize TanStack Query / server-fn errors for display. */
export function formatQueryError(error: unknown): string | null {
  if (error == null) return null;
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return "Something went wrong while loading data.";
}
