import { ExternalLink, FileText } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  DetailSection,
  EmptyHint,
} from "#/components/lecturer/sheets/detail-section";

type EvidenceItem = {
  id: string;
  file_name: string;
  file_url: string;
};

export function ClaimEvidenceSection({
  evidence,
  emptyHint = "No register uploaded.",
}: {
  evidence: EvidenceItem[];
  emptyHint?: string;
}) {
  return (
    <DetailSection
      title="Attendance evidence"
      description="Registers and files uploaded by the tutor."
      icon={FileText}
    >
      {evidence.length === 0 ? (
        <EmptyHint>{emptyHint}</EmptyHint>
      ) : (
        <ul className="space-y-2">
          {evidence.map((ev) => (
            <li
              key={ev.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 px-3 py-2.5 text-sm"
            >
              <span className="min-w-0 truncate font-medium">{ev.file_name}</span>
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <a href={ev.file_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </DetailSection>
  );
}
