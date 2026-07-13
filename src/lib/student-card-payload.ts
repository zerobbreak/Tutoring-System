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
          : typeof data.student_reference === "string"
            ? data.student_reference
            : typeof data.id === "string"
              ? data.id
              : null;
    if (!ref?.trim()) return null;
    const name =
      typeof data.name === "string"
        ? data.name
        : typeof data.fullName === "string"
          ? data.fullName
          : typeof data.full_name === "string"
            ? data.full_name
            : null;
    const email =
      typeof data.email === "string"
        ? data.email
        : typeof data.emailAddress === "string"
          ? data.emailAddress
          : null;
    return {
      studentReference: normalizeRef(ref),
      fullName: name?.trim() || null,
      email: email?.trim() || null,
    };
  } catch {
    return null;
  }
}

function isLikelyReferenceValue(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("name:") ||
    lower.startsWith("full name:") ||
    lower.startsWith("student name:") ||
    lower.startsWith("email:")
  ) {
    return false;
  }
  if (/^(student\s+id|student|id|ref|reference)\s*[:\-]?\s*/i.test(trimmed)) {
    return true;
  }
  if (/^stu\d+/i.test(trimmed) || /^s\d+/i.test(trimmed)) return true;
  if (/^[a-z]{2,}\d{2,}$/i.test(trimmed)) return true;
  if (/^\d{4,}$/.test(trimmed)) return true;
  return false;
}

function parseTextPayload(raw: string): ParsedStudentCard {
  const normalizedRaw = raw.trim();
  const lines = normalizedRaw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const semicolonParts = normalizedRaw
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (semicolonParts.length >= 2 && semicolonParts[0]) {
    return {
      studentReference: normalizeRef(semicolonParts[0]),
      fullName: null,
      email: null,
    };
  }

  let referenceValue: string | null = null;
  let nameValue: string | null = null;
  let emailValue: string | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase();

    if (!referenceValue && isLikelyReferenceValue(line)) {
      referenceValue = line.replace(
        /^(student\s+id|student|id|ref|reference)\s*[:\-]?\s*/i,
        "",
      ).trim();
      continue;
    }

    if (!nameValue && /^(name|full name|student name)\s*[:\-]?\s*/i.test(line)) {
      nameValue = line.replace(/^(name|full name|student name)\s*[:\-]?\s*/i, "").trim();
      continue;
    }

    if (!nameValue && !referenceValue && !lower.startsWith("email:")) {
      const words = line.split(/\s+/);
      if (words.length <= 4 && !isLikelyReferenceValue(line)) {
        nameValue = line;
      }
    }

    if (!emailValue && lower.startsWith("email:")) {
      emailValue = line.replace(/^email:\s*/i, "").trim();
    }
  }

  return {
    studentReference: normalizeRef(referenceValue ?? normalizedRaw),
    fullName: nameValue?.trim() || null,
    email: emailValue?.trim() || null,
  };
}

/** Parse a scanned student card string into reference + optional profile fields. */
export function parseStudentCardPayload(raw: string): ParsedStudentCard {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Empty scan. Try again.");
  }

  const json = parseJsonPayload(trimmed);
  if (json) return json;

  return parseTextPayload(trimmed);
}
