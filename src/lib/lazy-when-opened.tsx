import { Suspense, useEffect, useState, type ReactNode } from "react";

/** Mount lazy children on first open; keep mounted for close animation. */
export function LazyWhenOpened({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);
  if (!mounted) return null;
  return <Suspense fallback={null}>{children}</Suspense>;
}
