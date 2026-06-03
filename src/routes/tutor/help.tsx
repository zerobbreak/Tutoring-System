import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Calendar,
  ChevronDown,
  ClipboardCheck,
  LifeBuoy,
  Mail,
  MessageSquare,
  NotebookPen,
  QrCode,
  Settings,
  Video,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { APP_PATHS } from "#/lib/app-paths";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "#/components/ui/collapsible";
import { ScrollArea } from "#/components/ui/scroll-area";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/tutor/help")({
  component: TutorHelpPage,
});

type HelpTopic = {
  id: string;
  icon: typeof Video;
  title: string;
  summary: string;
  items: { question: string; answer: string }[];
};

const HELP_TOPICS: HelpTopic[] = [
  {
    id: "sessions",
    icon: Video,
    title: "Sessions workspace",
    summary: "Kanban board, session details, and QR attendance",
    items: [
      {
        question: "I cannot drag a session card between columns",
        answer:
          "Use the grip handle on the card and drop on Today, Upcoming, or Completed (not Claims pending). Drafts live on the calendar lanes; after you submit for verification they move to Claims pending. Dropping onto another card in the target column works. Submitted or disputed claims cannot be rescheduled from the board.",
      },
      {
        question: "A session does not appear on my board",
        answer:
          "Use the filters at the top (date range, module, status). New claims may start in Draft until you submit them from the session detail dialog. Confirm you are signed in as the tutor linked to that claim.",
      },
      {
        question: "Students cannot scan my QR code",
        answer:
          "Open Register generation, select the correct session, and generate a fresh token—old tokens expire. Share the QR in a well-lit room; the link must match your institution's attendance URL. If attendance stays empty, the session date may be in the future or the token was revoked.",
      },
    ],
  },
  {
    id: "claims",
    icon: ClipboardCheck,
    title: "Claims",
    summary: "Submitting hours and tracking verification status",
    items: [
      {
        question: "My claim is stuck in Pending verification",
        answer:
          "Lecturers or admins review submitted claims. Ensure session date, times, venue, and module match what was delivered. Open the claim detail page to see dispute notes if status changed to Disputed or Rejected.",
      },
      {
        question: "I cannot edit a claim",
        answer:
          "Verified or approved claims are read-only. For rejected or disputed claims, use Correct & resubmit (authenticator required) to return the claim to draft, make your changes, then submit again for verification.",
      },
    ],
  },
  {
    id: "notes",
    icon: NotebookPen,
    title: "Session notes",
    summary: "Structured notes and coverage confirmation",
    items: [
      {
        question: "Sync Workspace is disabled",
        answer:
          "The button enables only when you have unsaved changes. Select a session from the left list first. If you navigated here from Schedules with ?claim=, wait for the list to load—the correct claim should auto-select.",
      },
      {
        question: "Coverage validation will not save",
        answer:
          "Check the verification checkbox in Structured Capture, then click Sync Workspace. Validation timestamp is set the first time you confirm; unchecking clears it on the next save.",
      },
      {
        question: "AI insights buttons do nothing",
        answer:
          "AI-assisted summaries and quizzes are not live yet. Use the Structured Capture tab to record concepts, examples, struggles, and revision topics manually.",
      },
    ],
  },
  {
    id: "messaging",
    icon: MessageSquare,
    title: "Messaging",
    summary: "Conversations with lecturers and staff",
    items: [
      {
        question: "I cannot start a new conversation",
        answer:
          "Use New Conversation and search by name or email within your institution. If search returns no users, they may not share your institution or their profile name is missing. Creating a chat requires database permissions—contact support if you see a permission error.",
      },
      {
        question: "Messages do not appear in real time",
        answer:
          "Stay on the conversation in the sidebar; new messages appear when the connection is active. Refresh the page if the list looks stale. Switching conversations reloads history from the server.",
      },
    ],
  },
  {
    id: "schedules",
    icon: Calendar,
    title: "Schedules",
    summary: "Calendar imports and timetable uploads",
    items: [
      {
        question: "My spreadsheet upload failed",
        answer:
          "Use the provided CSV sample columns (date, start time, end time, module, venue). Remove merged cells and extra header rows. Excel files should be saved as .xlsx; very large files may time out—split by term if needed.",
      },
      {
        question: "Events show on the wrong day or time",
        answer:
          "Times should use 24-hour HH:mm format. Check your device timezone; the calendar stores session dates as entered. Re-upload after correcting the source file.",
      },
    ],
  },
  {
    id: "register",
    icon: QrCode,
    title: "Register generation",
    summary: "Attendance tokens and export",
    items: [
      {
        question: "Generate token fails",
        answer:
          "Select a session from the dropdown first. Only sessions you tutor appear. If generation spins indefinitely, sign out and back in, then try again.",
      },
      {
        question: "Attendance counts look wrong",
        answer:
          "Historical charts aggregate by session date. Students marked absent offline may not appear until sync completes. Cross-check the session detail attendance list in Sessions.",
      },
    ],
  },
  {
    id: "account",
    icon: Settings,
    title: "Account & access",
    summary: "Login, roles, and settings",
    items: [
      {
        question: "I am redirected to login when opening Tutor Studio",
        answer:
          "Your account must have a tutor role (or equivalent dashboard access). Ask an administrator to confirm your role in the system. Clear site cookies if you recently changed password.",
      },
      {
        question: "Where do I change my profile or password?",
        answer:
          "Open Settings from the sidebar footer. Profile and security options are managed there.",
      },
    ],
  },
];

function FaqItem({
  question,
  answer,
  defaultOpen,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-accent/50">
        <span>{question}</span>
        <ChevronDown
          className={cn(
            "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-3 pt-1 text-sm leading-relaxed text-muted-foreground">
        {answer}
      </CollapsibleContent>
    </Collapsible>
  );
}

function TutorHelpPage() {
  const [activeTopic, setActiveTopic] = useState(HELP_TOPICS[0]!.id);
  const topic =
    HELP_TOPICS.find((t) => t.id === activeTopic) ?? HELP_TOPICS[0]!;
  const TopicIcon = topic.icon;

  return (
    <ScrollArea className="h-full">
      <div className="rise-in space-y-8 p-4 md:p-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[var(--lagoon-deep)]">
            <LifeBuoy className="size-6" />
            <h1 className="display-title text-2xl font-bold tracking-tight text-[var(--sea-ink)]">
              Get Help
            </h1>
          </div>
          <p className="max-w-2xl text-sm text-[var(--sea-ink-soft)]">
            Common issues tutors run into across Tutor Studio. Pick a topic, or
            contact your institution if something is not listed here.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
          <nav className="flex flex-row flex-wrap gap-2 lg:flex-col lg:gap-1">
            {HELP_TOPICS.map((t) => {
              const Icon = t.icon;
              const active = t.id === activeTopic;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTopic(t.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-[var(--lagoon-deep)]/10 font-semibold text-[var(--lagoon-deep)]"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span>{t.title}</span>
                </button>
              );
            })}
          </nav>

          <Card className="island-shell border-white/40 bg-white/50 backdrop-blur-md">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-[var(--lagoon)]/15 p-2">
                  <TopicIcon className="size-5 text-[var(--lagoon-deep)]" />
                </div>
                <div>
                  <CardTitle>{topic.title}</CardTitle>
                  <CardDescription>{topic.summary}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {topic.items.map((item, i) => (
                <FaqItem
                  key={item.question}
                  question={item.question}
                  answer={item.answer}
                  defaultOpen={i === 0}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        <Card className="island-shell border-dashed border-[var(--lagoon)]/30 bg-white/40">
          <CardHeader>
            <CardTitle className="text-base">Still stuck?</CardTitle>
            <CardDescription>
              Use in-app links to jump to the area you need, or reach out to
              your coordinator.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to={APP_PATHS.tutor.sessions}>Sessions</Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to={APP_PATHS.tutor.claims}>Claims</Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to={APP_PATHS.tutor.messaging}>Messaging</Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-full" asChild>
              <Link to="/settings">Settings</Link>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="ml-auto gap-2 rounded-full"
              asChild
            >
              <a href="mailto:support@emerislearning.com">
                <Mail className="size-4" />
                Email support
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
