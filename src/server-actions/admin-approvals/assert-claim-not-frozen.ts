export function assertClaimNotFrozen(
  frozenAt: string | null | undefined,
  actionLabel = "modify this claim",
): void {
  if (frozenAt) {
    throw new Error(
      `This claim is frozen and cannot be updated. Unfreeze before you ${actionLabel}.`,
    );
  }
}
