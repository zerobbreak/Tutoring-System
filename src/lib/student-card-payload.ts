/**
 * Student ID card barcode/QR payload format.
 *
 * Preferred JSON: `{"ref":"S123456","name":"Jane Doe"}`
 * - `ref` (required): institution student number → `students.student_reference`
 * - `name` (optional): required only when creating a new student row
 * - `email` (optional): stored when creating a new student
 *
 * Fallback: plain text barcode value is treated as `ref` only.
 */
export type ParsedStudentCard = {
  studentReference: string;
  fullName: string | null;
  email: string | null;
};

function normalizeRef(value: string): string {
  return value.trim();
}

function parseJsonPayload(raw: string): ParsedStudentCard | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("{")) return null;
  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const ref =
      typeof data.ref === "string"
        ? data.ref
        : typeof data.studentReference === "string"
          ? data.studentReference
          : typeof data.id === "string"
            ? data.id
            : null;
    if (!ref?.trim()) return null;
    const name =
      typeof data.name === "string"
        ? data.name
        : typeof data.fullName === "string"
          ? data.fullName
          : null;
    const email = typeof data.email === "string" ? data.email : null;
    return {
      studentReference: normalizeRef(ref),
      fullName: name?.trim() || null,
      email: email?.trim() || null,
    };
  } catch {
    return null;
  }
}

/** Parse a scanned student card string into reference + optional profile fields. */
export function parseStudentCardPayload(raw: string): ParsedStudentCard {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty scan. Try again.");
  }

  const json = parseJsonPayload(trimmed);
  if (json) return json;

  return {
    studentReference: normalizeRef(trimmed),
    fullName: null,
    email: null,
  };
}
