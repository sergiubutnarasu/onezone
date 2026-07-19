import { CommandBlock } from "./CommandBlock";
import { DiffBlock } from "./DiffBlock";
import { FileOperationBlock } from "./FileOperationBlock";
import { SkillOperationBlock } from "./SkillOperationBlock";
import type { ToolDisplayBlock } from "./types";

interface ToolDisplayBlockViewProps {
  block: ToolDisplayBlock;
}

export function ToolDisplayBlockView({ block }: ToolDisplayBlockViewProps) {
  if (block.kind === "file_operation") return <FileOperationBlock {...block} />;
  if (block.kind === "skill_operation") return <SkillOperationBlock {...block} />;
  if (block.kind === "command_operation") return <CommandBlock command={block.command} title={block.title} props={block.props} />;
  if (block.kind === "command") return <CommandBlock command={block.command} title={block.title} />;
  return <DiffBlock diff={block.diff} title={block.title} />;
}