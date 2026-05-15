import type {
  VerificationClaimCardDTO,
  VerificationModuleOptionDTO,
} from "#/server-actions/lecturer-verification";

export type VerificationQueueViewProps = {
  booting: boolean;
  loadError: string | null;
  search: string;
  moduleId: string;
  modules: VerificationModuleOptionDTO[];
  pending: VerificationClaimCardDTO[];
  disputed: VerificationClaimCardDTO[];
  recentlyVerified: VerificationClaimCardDTO[];
  selectedClaimId: string | null;
  sheetOpen: boolean;
  onSearchChange: (value: string) => void;
  onModuleChange: (value: string) => void;
  onReview: (claimId: string) => void;
  onSheetOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
};
