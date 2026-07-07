"use client";

import { useRef, useEffect } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { MessageLine } from "@/components/MessageLine";
import { CommandGroup } from "@/components/command-group";
import type { ChatItem } from "../_lib/chat-items";

interface TaskChatAreaProps {
  chatItems: ChatItem[];
  onStop?: (jobId: string) => void;
}

export function TaskChatArea({ chatItems, onStop }: TaskChatAreaProps) {
  const scrollParentRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: chatItems.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: (i) => {
      const item = chatItems[i];
      if (item.type === "command") return 40 + item.group.lines.length * 18;
      return 24;
    },
    measureElement: (el) => el.getBoundingClientRect().height,
    overscan: 10,
  });

  // Track whether user is scrolled to bottom
  useEffect(() => {
    const el = scrollParentRef.current;
    if (!el) return;
    const handleScroll = () => {
      isAtBottomRef.current =
        el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll to bottom on new messages only if user hasn't scrolled away
  useEffect(() => {
    if (chatItems.length > 0 && isAtBottomRef.current) {
      virtualizer.scrollToIndex(chatItems.length - 1, { align: "end" });
    }
  }, [chatItems]);

  return (
    <div
      ref={scrollParentRef}
      className="flex-1 min-h-0 overflow-y-auto chat-scroll"
    >
      <div
        className="relative py-2 pb-4 font-mono text-sm"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = chatItems[virtualRow.index];
          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {item.type === "command" ? (
                <CommandGroup group={item.group} onStop={onStop} />
              ) : (
                <MessageLine message={item.msg} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
