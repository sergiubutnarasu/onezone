"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import type { Notification } from "@onezone/shared";
import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CheckCheck,
  CheckCircle,
  Inbox,
  Loader2,
  Play,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

function NotificationIcon({ type }: { type: Notification["type"] }) {
  if (type === "TASK_COMPLETED")
    return <CheckCircle className="size-4 text-success shrink-0 mt-0.5" />;
  if (type === "COMMAND_EXIT_SUCCESS")
    return <CheckCircle className="size-4 text-info shrink-0 mt-0.5" />;
  if (type === "COMMAND_START")
    return <Play className="size-4 text-muted-foreground shrink-0 mt-0.5" />;
  return <XCircle className="size-4 text-destructive shrink-0 mt-0.5" />;
}

function NotificationRow({
  notif,
  onMarkRead,
}: {
  notif: Notification;
  onMarkRead: (id: string) => void;
}) {
  const isUnread = notif.readAt === null;
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3.5 border-b border-border/50 last:border-0",
        isUnread && "bg-accent/30",
      )}
    >
      <NotificationIcon type={notif.type} />
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{notif.message}</p>
        <div className="flex items-center gap-2 mt-1">
          <Link
            href={`/projects/${notif.project.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
          >
            {notif.project.name}
          </Link>
          <span className="text-xs text-muted-foreground/50">·</span>
          <Link
            href={`/projects/${notif.project.id}/tasks/${notif.task.id}`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors truncate"
          >
            {notif.task.name}
          </Link>
          <span className="text-xs text-muted-foreground/50">·</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {timeAgo(notif.createdAt)}
          </span>
        </div>
      </div>
      {isUnread && (
        <button
          onClick={() => onMarkRead(notif.id)}
          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label="Mark as read"
          title="Mark as read"
        >
          <CheckCheck className="size-4" />
        </button>
      )}
    </div>
  );
}

function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-b border-border/50">
      <Skeleton className="size-4 rounded-full mt-0.5 shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-3.5 w-3/4" />
        <Skeleton className="h-3 w-1/3 mt-1.5" />
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [showRead, setShowRead] = useState(false);
  const qc = useQueryClient();

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ["notifications", showRead],
      queryFn: ({ pageParam }) => fetchNotifications(showRead, pageParam),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.hasMore ? lastPage.page + 1 : undefined,
    });

  const notifications = data?.pages.flatMap((p) => p.data) ?? [];

  const markRead = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const unreadCount = notifications.filter((n) => n.readAt === null).length;

  return (
    <div className="max-w-2xl p-4 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="text-display">Notifications</h1>
          {!showRead && unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount}</Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRead((v) => !v)}
          >
            {showRead ? (
              <>
                <span className="sm:hidden">Unread</span>
                <span className="hidden sm:inline">Show unread</span>
              </>
            ) : (
              <>
                <span className="sm:hidden">All</span>
                <span className="hidden sm:inline">Show all</span>
              </>
            )}
          </Button>
          {!showRead && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => markAllRead.mutate()}
              disabled={markAllRead.isPending}
              aria-label="Mark all read"
            >
              <CheckCheck className="size-3.5 mr-1.5" />
              <span className="hidden sm:inline">Mark all read</span>
            </Button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="rounded-lg border border-border overflow-hidden">
        {isLoading ? (
          <>
            <NotificationSkeleton />
            <NotificationSkeleton />
            <NotificationSkeleton />
          </>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <Inbox className="size-8 mb-1 opacity-40" />
            <p className="text-sm font-medium">
              {showRead ? "No notifications yet" : "No unread notifications"}
            </p>
            {!showRead && (
              <button
                onClick={() => setShowRead(true)}
                className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
              >
                View old notifications
              </button>
            )}
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationRow
              key={n.id}
              notif={n}
              onMarkRead={(id) => markRead.mutate(id)}
            />
          ))
        )}
      </div>
      {hasNextPage && (
        <div className="flex justify-center mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
            ) : null}
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
