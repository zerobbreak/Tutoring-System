import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { TutorScheduleUploadZone } from "./tutor-schedule-upload-zone";

type TutorScheduleImportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  busy: boolean;
  loadingSaved: boolean;
  onFile: (file: File) => void;
  onSampleDownload: () => void;
};

export function TutorScheduleImportSheet({
  open,
  onOpenChange,
  busy,
  loadingSaved,
  onFile,
  onSampleDownload,
}: TutorScheduleImportSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Import timetable</SheetTitle>
          <SheetDescription>
            Upload CSV or Excel exports. Multiple files merge into one calendar
            and are saved to your account.
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6">
          <TutorScheduleUploadZone
            variant="compact"
            busy={busy}
            loadingSaved={loadingSaved}
            onFile={onFile}
            onSampleDownload={onSampleDownload}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
