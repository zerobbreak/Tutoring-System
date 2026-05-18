import type { ClaimCreationSource } from "#/lib/claim-creation-source";

export function creationSourceForSessionKind(
  sessionKind: string | null | undefined,
): ClaimCreationSource {
  if (sessionKind === "one_off") return "LECTURER_ONE_OFF";
  return "SCHEDULE";
}
