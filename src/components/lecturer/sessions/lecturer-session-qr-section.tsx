import { formatDistanceToNow, isAfter, parseISO } from "date-fns";
import { QrCode } from "lucide-react";
import { DetailSection } from "#/components/lecturer/sheets/detail-section";

export function LecturerSessionQrSection({
  attendanceScanCount,
  qrExpiresAt,
  qrUrl,
}: {
  attendanceScanCount: number;
  qrExpiresAt: string | null;
  qrUrl: string | null;
}) {
  const qrExpired = qrExpiresAt
    ? isAfter(new Date(), parseISO(qrExpiresAt))
    : false;

  return (
    <DetailSection
      title="QR attendance"
      description="Scan count and QR expiry for this session."
      icon={QrCode}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Scans</dt>
        <dd className="font-medium tabular-nums text-foreground">
          {attendanceScanCount}
        </dd>
        {qrExpiresAt ? (
          <>
            <dt className="text-muted-foreground">Expires</dt>
            <dd className="text-foreground">
              {formatDistanceToNow(parseISO(qrExpiresAt), {
                addSuffix: true,
              })}
              {qrExpired ? (
                <span className="text-amber-700"> (expired)</span>
              ) : null}
            </dd>
          </>
        ) : null}
      </dl>
      {qrUrl ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Tutor session link is available on the tutor sessions page.
        </p>
      ) : null}
    </DetailSection>
  );
}
