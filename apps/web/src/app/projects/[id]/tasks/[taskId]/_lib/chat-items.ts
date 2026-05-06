import { MessageType } from "@onezone/shared";
import type { RoomMessage } from "@/hooks/useTaskRoom";
import type { CommandGroupData } from "@/components/CommandGroup";

export type ChatItem =
  | { type: "message"; msg: RoomMessage }
  | { type: "command"; group: CommandGroupData };

function handleCommandGroup(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group: CommandGroupData = {
    jobId: msg.jobId,
    command: msg.command ?? msg.content,
    terminalName: msg.terminalName,
    startTs: msg.ts,
    lines: [],
  };
  groupMap.set(msg.jobId, group);
  items.push({ type: "message", msg });
  items.push({ type: "command", group });
}

function handleOutputLine(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  let group = groupMap.get(msg.jobId);
  if (!group) {
    group = {
      jobId: msg.jobId,
      command: msg.command ?? "(unknown)",
      terminalName: msg.terminalName,
      startTs: msg.ts,
      lines: [],
    };
    groupMap.set(msg.jobId, group);
    items.push({ type: "command", group });
  }
  group.lines.push(msg);
}

function handleCommandExit(
  msg: RoomMessage,
  groupMap: Map<string, CommandGroupData>,
  items: ChatItem[],
): void {
  if (!msg.jobId) return;
  const group = groupMap.get(msg.jobId);
  const code =
    msg.exitCode ??
    parseInt(msg.content.match(/exited with code (\d+)/)?.[1] ?? "-1", 10);
  if (group) group.exitCode = code;
  items.push({
    type: "message",
    msg: { ...msg, exitCode: code, content: msg.command ?? msg.content },
  });
}

export function buildChatItems(messages: RoomMessage[]): ChatItem[] {
  const groupMap = new Map<string, CommandGroupData>();
  const items: ChatItem[] = [];

  for (const msg of messages) {
    if (msg.jobId) {
      if (msg.messageType === MessageType.CommandStart) {
        handleCommandGroup(msg, groupMap, items);
        continue;
      }
      if (msg.role === "terminal") {
        handleOutputLine(msg, groupMap, items);
        continue;
      }
      if (
        msg.role === "system" &&
        (msg.exitCode != null || msg.content.includes("exited with code"))
      ) {
        handleCommandExit(msg, groupMap, items);
        continue;
      }
    }
    items.push({ type: "message", msg });
  }

  return items;
}
