import type { NavigateOptions } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import {
  Loader2,
  Megaphone,
  MessageSquare,
  Plus,
  Scale,
} from "lucide-react";
import * as React from "react";
import { ConversationSidebar } from "#/components/messaging/ConversationSidebar";
import { ChatWindow } from "#/components/messaging/ChatWindow";
import {
  NewConversationDialog,
  type NewConversationUser,
} from "#/components/messaging/NewConversationDialog";
import { useMessagingPage } from "#/components/messaging/use-messaging-page";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { Skeleton } from "#/components/ui/skeleton";
import { toast } from "#/lib/toast";
import {
  ADMIN_MESSAGING_UI_CATEGORIES,
  NOTICE_TYPES,
  adminUiCategoryMatchesConversation,
  createAdminDirectConversationFn,
  createInstitutionNoticeFn,
  joinAdminDisputeConversationFn,
  listOpenDisputesForMessagingFn,
  searchInstitutionUsersForAdminFn,
  type AdminDisputeMessagingRowDTO,
  type AdminMessagingUiCategoryId,
  type NoticeType,
} from "#/server-actions/messaging";

const selectContentProps = {
  position: "popper" as const,
  className: "z-[200]",
};

export type AdminMessagingSearch = {
  conversation?: string;
  dispute?: string;
  compose?: "notice" | "broadcast";
};

type AdminMessagingViewProps = {
  search: AdminMessagingSearch;
  navigate: (opts: NavigateOptions) => void | Promise<void>;
};

type NoticeFormState = {
  noticeType: NoticeType;
  title: string;
  content: string;
};

export function AdminMessagingView({ search, navigate }: AdminMessagingViewProps) {
  const [isNewChatOpen, setIsNewChatOpen] = React.useState(false);
  const [noticeOpen, setNoticeOpen] = React.useState(false);
  const [disputesOpen, setDisputesOpen] = React.useState(false);
  const [disputes, setDisputes] = React.useState<AdminDisputeMessagingRowDTO[]>([]);
  const [disputesLoading, setDisputesLoading] = React.useState(false);
  const [noticeSubmitting, setNoticeSubmitting] = React.useState(false);
  const [joiningDisputeId, setJoiningDisputeId] = React.useState<string | null>(null);
  const [noticeForm, setNoticeForm] = React.useState<NoticeFormState>({
    noticeType: NOTICE_TYPES.SYSTEM,
    title: "",
    content: "",
  });

  const {
    conversations,
    setConversations,
    selectedConvId,
    setSelectedConvId,
    selectedConversation,
    messages,
    currentUserId,
    isLoading,
    isMessagesLoading,
    handleSendMessage,
    handleConversationCreated,
  } = useMessagingPage({ initialConversationId: search.conversation });

  const openNoticeDialog = React.useCallback(
    (preset?: "broadcast") => {
      setNoticeForm({
        noticeType:
          preset === "broadcast"
            ? NOTICE_TYPES.ANNOUNCEMENT
            : NOTICE_TYPES.SYSTEM,
        title: "",
        content: "",
      });
      setNoticeOpen(true);
    },
    [],
  );

  React.useEffect(() => {
    if (!search.compose) return;
    if (search.compose === "broadcast") openNoticeDialog("broadcast");
    else openNoticeDialog();
    void navigate({
      to: "/admin/messaging",
      search: {
        conversation: search.conversation,
        dispute: search.dispute,
      },
      replace: true,
    });
  }, [search.compose]);

  React.useEffect(() => {
    if (!search.dispute) return;
    let cancelled = false;
    (async () => {
      try {
        const { conversationId } = await joinAdminDisputeConversationFn({
          data: { disputeId: search.dispute! },
        });
        if (cancelled) return;
        setSelectedConvId(conversationId);
        await handleConversationCreated(conversationId);
        void navigate({
          to: "/admin/messaging",
          search: { conversation: conversationId, dispute: undefined },
          replace: true,
        });
      } catch (e) {
        toast.error(
          e instanceof Error ? e.message : "Failed to open dispute thread",
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [search.dispute]);

  const loadDisputes = React.useCallback(async () => {
    setDisputesLoading(true);
    try {
      const rows = await listOpenDisputesForMessagingFn();
      setDisputes(rows);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load disputes");
      setDisputes([]);
    } finally {
      setDisputesLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (disputesOpen) void loadDisputes();
  }, [disputesOpen, loadDisputes]);

  const handleSelectConversation = (id: string) => {
    setSelectedConvId(id);
    void navigate({
      to: "/admin/messaging",
      search: { conversation: id },
      replace: true,
    });
  };

  const handleNoticeSubmit = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      toast.error("Title and message are required.");
      return;
    }
    setNoticeSubmitting(true);
    try {
      const { conversationId } = await createInstitutionNoticeFn({
        data: {
          noticeType: noticeForm.noticeType,
          title: noticeForm.title.trim(),
          content: noticeForm.content.trim(),
        },
      });
      toast.success(
        noticeForm.noticeType === NOTICE_TYPES.ANNOUNCEMENT
          ? "Announcement sent"
          : "Notice created",
      );
      setNoticeOpen(false);
      await handleConversationCreated(conversationId);
      void navigate({
        to: "/admin/messaging",
        search: { conversation: conversationId },
        replace: true,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to send notice");
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const handleJoinDispute = async (disputeId: string) => {
    setJoiningDisputeId(disputeId);
    try {
      const { conversationId } = await joinAdminDisputeConversationFn({
        data: { disputeId },
      });
      setDisputesOpen(false);
      await handleConversationCreated(conversationId);
      void navigate({
        to: "/admin/messaging",
        search: { conversation: conversationId },
        replace: true,
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to open dispute thread",
      );
    } finally {
      setJoiningDisputeId(null);
    }
  };

  const searchAdminUsers = React.useCallback(async (query: string) => {
    return searchInstitutionUsersForAdminFn({ data: { query } });
  }, []);

  const createAdminDirect = React.useCallback(async (user: NewConversationUser) => {
    const { conversationId } = await createAdminDirectConversationFn({
      data: { targetUserId: user.id },
    });
    return conversationId;
  }, []);

  if (isLoading) {
    return (
      <div className="flex h-full w-full">
        <div className="w-80 space-y-4 border-r p-4">
          <Skeleton className="h-10 w-full" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col">
          <Skeleton className="h-16 w-full border-b" />
          <div className="flex-1 p-6">
            <Skeleton className="h-20 w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2">
        <p className="mr-auto text-sm text-muted-foreground">
          Institutional messaging — tutors, lecturers, notices, and disputes.
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsNewChatOpen(true)}
        >
          <MessageSquare className="mr-1.5 size-4" />
          Message user
        </Button>
        <Button size="sm" variant="outline" onClick={() => openNoticeDialog()}>
          <Plus className="mr-1.5 size-4" />
          Create notice
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => openNoticeDialog("broadcast")}
        >
          <Megaphone className="mr-1.5 size-4" />
          Broadcast
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setDisputesOpen(true)}
        >
          <Scale className="mr-1.5 size-4" />
          Disputes
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <ConversationSidebar
          title="Messaging"
          conversations={conversations}
          selectedId={selectedConvId}
          onSelect={handleSelectConversation}
          onCreateNew={() => setIsNewChatOpen(true)}
          categories={ADMIN_MESSAGING_UI_CATEGORIES}
          categoryIconSet="admin"
          categoryMatcher={(catId, conv) =>
            adminUiCategoryMatchesConversation(
              catId as AdminMessagingUiCategoryId,
              conv,
            )
          }
        />

        {selectedConversation && currentUserId ? (
          <ChatWindow
            conversation={selectedConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            currentUserId={currentUserId}
            isLoading={isMessagesLoading}
            onPinChange={(pinned) => {
              setConversations((prev) =>
                prev.map((c) =>
                  c.id === selectedConversation.id
                    ? { ...c, my_is_pinned: pinned }
                    : c,
                ),
              );
            }}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center bg-muted/5 p-12 text-center">
            <MessageSquare className="mb-6 h-10 w-10 text-muted-foreground/30" />
            <h2 className="text-2xl font-bold tracking-tight">
              Select a conversation
            </h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Message tutors and lecturers, send institutional notices, or open a
              dispute thread.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button
                className="gap-2 rounded-full px-6"
                onClick={() => setIsNewChatOpen(true)}
              >
                <Plus className="h-4 w-4" />
                New message
              </Button>
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => openNoticeDialog("broadcast")}
              >
                <Megaphone className="mr-2 h-4 w-4" />
                Broadcast
              </Button>
            </div>
          </div>
        )}
      </div>

      <NewConversationDialog
        open={isNewChatOpen}
        onOpenChange={setIsNewChatOpen}
        title="Message tutor or lecturer"
        description="Search institution staff to start a direct conversation."
        searchUsers={searchAdminUsers}
        onSelectUser={createAdminDirect}
        onConversationCreated={(id) => void handleConversationCreated(id)}
      />

      <Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {noticeForm.noticeType === NOTICE_TYPES.ANNOUNCEMENT
                ? "Broadcast announcement"
                : "Create notice"}
            </DialogTitle>
            <DialogDescription>
              Sent to all tutors and lecturers in your institution as a group
              conversation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={noticeForm.noticeType}
                onValueChange={(v) =>
                  setNoticeForm((f) => ({
                    ...f,
                    noticeType: v as NoticeType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent {...selectContentProps}>
                  <SelectItem value={NOTICE_TYPES.SYSTEM}>System notice</SelectItem>
                  <SelectItem value={NOTICE_TYPES.ACADEMIC}>
                    Academic notice
                  </SelectItem>
                  <SelectItem value={NOTICE_TYPES.PAYROLL}>
                    Payroll notice
                  </SelectItem>
                  <SelectItem value={NOTICE_TYPES.ANNOUNCEMENT}>
                    Announcement (broadcast)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-title">Title</Label>
              <Input
                id="notice-title"
                value={noticeForm.title}
                onChange={(e) =>
                  setNoticeForm((f) => ({ ...f, title: e.target.value }))
                }
                placeholder="Notice title"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notice-body">Message</Label>
              <textarea
                id="notice-body"
                rows={5}
                value={noticeForm.content}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setNoticeForm((f) => ({ ...f, content: e.target.value }))
                }
                placeholder="Write your notice…"
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoticeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleNoticeSubmit()} disabled={noticeSubmitting}>
              {noticeSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : null}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={disputesOpen} onOpenChange={setDisputesOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Open disputes</SheetTitle>
            <SheetDescription>
              Join dispute threads to coordinate with tutors and lecturers.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {disputesLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : disputes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open disputes.</p>
            ) : (
              disputes.map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border p-3 text-sm"
                >
                  <p className="font-medium">
                    {d.module_code} · {d.module_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.tutor_name} ·{" "}
                    {format(parseISO(d.raised_at), "d MMM yyyy")}
                  </p>
                  <p className="mt-2 line-clamp-2 text-muted-foreground">
                    {d.reason}
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    variant="outline"
                    disabled={joiningDisputeId === d.id}
                    onClick={() => void handleJoinDispute(d.id)}
                  >
                    {joiningDisputeId === d.id ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : null}
                    Open thread
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
