/** Unwrap PostgREST nested relations that may return a singleton object or a one-element array. */
export function normalizeSupabaseNestedRow<T>(
  item: T | T[] | null | undefined,
): T | null {
  if (item == null) return null;
  return Array.isArray(item) ? item[0] ?? null : item;
}
