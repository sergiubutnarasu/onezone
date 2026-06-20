import { parseRunnerPayload } from "@onezone/shared";
import type { RoomMessage } from "@/types/room";
import type { GroupedLine } from "./types";

export function getDisplayCommand(command: string): string {
  const payload = parseRunnerPayload<{ kanbanColumnName?: string }>(command);
  return payload?.kanbanColumnName ?? command;
}

export function isSetupLine(content: string): boolean {
  return (
    content.startsWith("Setting up") ||
    content.startsWith("Checking") ||
    content.startsWith("✔") ||
    content.startsWith("✖") ||
    content.startsWith("Installing") ||
    content.startsWith("[skill]") ||
    content.startsWith("Skipping")
  );
}

export function groupSetupLines(lines: RoomMessage[]): GroupedLine[] {
  const result: GroupedLine[] = [];
  let setupBuffer: RoomMessage[] = [];

  for (const msg of lines) {
    if (isSetupLine(msg.content)) {
      setupBuffer.push(msg);
      continue;
    }
    if (setupBuffer.length > 0) {
      result.push({ kind: "setup", lines: setupBuffer });
      setupBuffer = [];
    }
    result.push({ kind: "output", msg });
  }

  if (setupBuffer.length > 0) {
    result.push({ kind: "setup", lines: setupBuffer });
  }

  return result;
}

/** Strip leading line numbers added by the agent's file-reading tool (e.g. "1 # Heading" → "# Heading") */
export function stripLineNumbers(text: string): string {
  return text
    .split("\n")
    .map((line) => line.replace(/^\d+ /, ""))
    .join("\n");
}
