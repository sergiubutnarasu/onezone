export interface ParsedAgentLine {
  content?: string;
  inputTokens?: number;
  outputTokens?: number;
  result?: {
    usage?: {
      totalCostUsd?: number;
      inputTokens?: number;
      outputTokens?: number;
    };
    nextColumnId?: string | null;
    finished?: boolean;
  };
}

export type AgentOutputParser = (line: string) => ParsedAgentLine | undefined;

export function parseNextColumnTag(text: string): string | null | undefined {
  const match = text.match(/\[\[ONEZONE_NEXT_COLUMN:(\S+)\]\]/);
  if (!match) return undefined;
  return match[1] === "backlog" ? null : match[1];
}
