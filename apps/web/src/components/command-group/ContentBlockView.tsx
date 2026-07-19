"use client";

import { useEffect, useState } from "react";
import { CommandBlock } from "./CommandBlock";
import { DiffBlock } from "./DiffBlock";
import { RawBlock } from "./RawBlock";
import { TextBlock } from "./TextBlock";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolResultBlock } from "./ToolResultBlock";
import { ToolUseBlock } from "./ToolUseBlock";
import type { ContentBlockViewProps } from "./types";

export function ContentBlockView({
  block,
  expandSignal,
  expandDirection,
}: ContentBlockViewProps) {
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [toolOpen, setToolOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setThinkingOpen(expandDirection);
      setToolOpen(expandDirection);
      setResultOpen(expandDirection);
    }, 0);
    return () => clearTimeout(id);
  }, [expandSignal, expandDirection]);

  if (block.kind === "text") {
    return <TextBlock text={block.text} />;
  }

  if (block.kind === "thinking") {
    return <ThinkingBlock text={block.text} open={thinkingOpen} onOpenChange={setThinkingOpen} />;
  }

  if (block.kind === "command") {
    return <CommandBlock command={block.command} title={block.title} />;
  }

  if (block.kind === "diff") {
    return <DiffBlock diff={block.diff} title={block.title} />;
  }

  if (block.kind === "tool_use") {
    return (
      <ToolUseBlock
        block={block}
        open={toolOpen}
        onOpenChange={setToolOpen}
      />
    );
  }

  if (block.kind === "tool_result") {
    return <ToolResultBlock text={block.text} open={resultOpen} onOpenChange={setResultOpen} />;
  }

  return <RawBlock text={block.text} />;
}
