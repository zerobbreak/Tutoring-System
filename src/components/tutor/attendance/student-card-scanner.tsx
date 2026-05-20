import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { AlertCircle, Camera, CameraOff, Loader2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/utils";

const SCAN_COOLDOWN_MS = 2500;

type StudentCardScannerProps = {
  enabled: boolean;
  busy?: boolean;
  onScan: (payload: string) => void | Promise<void>;
  className?: string;
};

export function StudentCardScanner({
  enabled,
  busy = false,
  onScan,
  className,
}: StudentCardScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const lastScanRef = useRef(0);
  const processingRef = useRef(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manualRef, setManualRef] = useState("");
  const manualInputId = useId();

  const handleDecoded = useCallback(
    async (text: string) => {
      const now = Date.now();
      if (processingRef.current || busy) return;
      if (now - lastScanRef.current < SCAN_COOLDOWN_MS) return;
      lastScanRef.current = now;
      processingRef.current = true;
      try {
        await onScan(text);
      } finally {
        processingRef.current = false;
      }
    },
    [busy, onScan],
  );

  useEffect(() => {
    if (!enabled || !cameraOn) return;

    const reader = new BrowserMultiFormatReader();
    let cancelled = false;

    const start = async () => {
      setCameraError(null);
      try {
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current!,
          (result) => {
            if (cancelled) return;
            if (result) {
              void handleDecoded(result.getText());
            }
          },
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;
      } catch (e) {
        if (!cancelled) {
          setCameraError(
            e instanceof Error
              ? e.message
              : "Could not access the camera. Use manual entry below.",
          );
          setCameraOn(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [enabled, cameraOn, handleDecoded]);

  const submitManual = () => {
    const value = manualRef.trim();
    if (!value || busy) return;
    void handleDecoded(value);
    setManualRef("");
  };

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/30">
        <video
          ref={videoRef}
          className={cn(
            "aspect-[4/3] w-full bg-black object-cover",
            !cameraOn && "hidden",
          )}
          muted
          playsInline
        />
        {!cameraOn ? (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 p-6 text-center">
            <ScanLine className="size-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {enabled
                ? "Start the camera to scan student barcodes or QR codes."
                : "Select an active session to enable scanning."}
            </p>
            <Button
              type="button"
              size="sm"
              className="gap-2"
              disabled={!enabled || busy}
              onClick={() => setCameraOn(true)}
            >
              <Camera className="size-4" />
              Start scanner
            </Button>
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-between p-2">
            <span className="rounded-md bg-black/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
              {busy ? "Processing…" : "Scanning"}
            </span>
            {busy ? (
              <Loader2 className="size-5 animate-spin text-white" />
            ) : null}
          </div>
        )}
      </div>

      {cameraError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-100">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{cameraError}</p>
        </div>
      ) : null}

      {cameraOn ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => {
            controlsRef.current?.stop();
            controlsRef.current = null;
            setCameraOn(false);
          }}
        >
          <CameraOff className="size-4" />
          Stop camera
        </Button>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={manualInputId} className="text-xs text-muted-foreground">
          Manual entry (student number or JSON from card)
        </Label>
        <div className="flex gap-2">
          <Input
            id={manualInputId}
            value={manualRef}
            onChange={(e) => setManualRef(e.target.value)}
            placeholder='S12345 or {"ref":"S12345","name":"Jane Doe"}'
            disabled={!enabled || busy}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitManual();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={!enabled || busy || !manualRef.trim()}
            onClick={submitManual}
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}
