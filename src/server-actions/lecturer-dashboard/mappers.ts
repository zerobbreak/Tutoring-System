import { unwrapOne } from "./unwrap";
import type {
  LecturerClaimDTO,
  LecturerEvidencePreviewDTO,
  LecturerPendingClaimDTO,
  RawClaimRow,
  RawPendingRow,
} from "./types";

export function mapClaimRow(r: RawClaimRow): LecturerClaimDTO {
  return { ...r, module: unwrapOne(r.module) };
}

export function mapPendingRow(
  r: RawPendingRow,
  evidenceByClaim: Map<string, LecturerEvidencePreviewDTO[]>,
): LecturerPendingClaimDTO {
  const preview = evidenceByClaim.get(r.id) ?? [];
  return {
    ...r,
    module: unwrapOne(r.module),
    tutor: unwrapOne(r.tutor),
    evidenceCount: preview.length,
    evidencePreview: preview.slice(0, 3),
  };
}
