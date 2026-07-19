import type { ContentBlock } from "@/lib/agent-content";
import { parseSkillCommand } from "@/lib/skills";
import { EDIT_TOOL_NAMES, READ_TOOL_NAMES, SKILL_ARG_METADATA_KEYS, WRITE_TOOL_NAMES } from "./constants";
import type { ToolDisplayBlock } from "./types";

export function getToolDisplayBlock(block: Extract<ContentBlock, { kind: "tool_use" }>): ToolDisplayBlock | null {
  const toolName = block.name.toLowerCase();
  const filePath = stringInput(block.input.file_path) ?? stringInput(block.input.filePath) ?? stringInput(block.input.path);

  if (READ_TOOL_NAMES.has(toolName)) {
    return {
      kind: "file_operation",
      operation: "read",
      filePath,
      title: "read file",
      details: compactStrings([
        rangeDetail(block.input),
        numberDetail("offset", block.input.offset),
        numberDetail("limit", block.input.limit),
      ]),
      props: getAdditionalProps(block.input, ["file_path", "filePath", "path", "startLine", "start_line", "endLine", "end_line", "offset", "limit"]),
    };
  }

  if (WRITE_TOOL_NAMES.has(toolName)) {
    const content = stringInput(block.input.content) ?? stringInput(block.input.file_text);
    return {
      kind: "file_operation",
      operation: "write",
      filePath,
      title: toolName === "create_file" ? "create file" : "write file",
      details: content ? [`${content.length.toLocaleString()} chars`] : [],
      props: getAdditionalProps(block.input, ["file_path", "filePath", "path", "content", "file_text"]),
      preview: content,
    };
  }

  if (EDIT_TOOL_NAMES.has(toolName)) {
    const diff = buildEditDiff(filePath, block.input);
    return {
      kind: "file_operation",
      operation: "edit",
      filePath,
      title: toolName === "multiedit" ? "edit file (multi)" : "edit file",
      details: compactStrings([booleanDetail("replace all", block.input.replace_all)]),
      props: getAdditionalProps(block.input, [
        "file_path",
        "filePath",
        "path",
        "old_string",
        "old_str",
        "new_string",
        "new_str",
        "edits",
        "replace_all",
      ]),
      diff,
    };
  }

  const skillBlock = buildSkillOperationBlock(block.name, block.input);
  if (skillBlock) return skillBlock;

  const command = block.input.command;
  if (typeof command === "string" && command.trim()) {
    const parsedSkill = parseSkillCommand(command);
    if (parsedSkill) {
      const args = getSkillArgs(block.input);
      return {
        kind: "skill_operation",
        title: "install skill",
        skillName: parsedSkill.skillName,
        source: parsedSkill.source,
        command,
        details: [],
        args,
        props: getSkillProps(block.input, args),
      };
    }

    return { kind: "command_operation", command, title: getCommandTitle(block.name, block.input), props: getCommandProps(block.input) };
  }

  const patch = block.input.input;
  if (typeof patch === "string" && patch.includes("*** Begin Patch")) {
    return { kind: "diff", diff: patch, title: block.name };
  }

  const diff = block.input.diff;
  if (typeof diff === "string" && diff.trim()) {
    return { kind: "diff", diff, title: block.name };
  }

  return null;
}

export function formatDisplayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value == null) return "null";
  return JSON.stringify(value, null, 2);
}

function getCommandProps(input: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const wrapperKeys = new Set(["arguments", "args", "input", "properties"]);
  const title = stringInput(input.description);

  for (const [key, value] of Object.entries(input)) {
    if (key === "command" || key === "description") continue;
    if (wrapperKeys.has(key) && isRecord(value)) continue;
    props[key] = value;
  }

  for (const key of wrapperKeys) {
    const value = input[key];
    if (!isRecord(value)) continue;

    for (const [nestedKey, nestedValue] of Object.entries(value)) {
      if (nestedKey === "command") continue;
      if (nestedKey === "description" && stringInput(nestedValue) === title) continue;
      if (nestedKey in props && sameDisplayValue(props[nestedKey], nestedValue)) continue;
      props[nestedKey] = nestedValue;
    }
  }

  return props;
}

function getCommandTitle(fallback: string, input: Record<string, unknown>): string {
  return stringInput(input.description) ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sameDisplayValue(left: unknown, right: unknown): boolean {
  return formatDisplayValue(left) === formatDisplayValue(right);
}

function buildSkillOperationBlock(name: string, input: Record<string, unknown>): ToolDisplayBlock | null {
  const toolName = name.toLowerCase();
  const isSkillTool = toolName.includes("skill") || looksLikeSkillName(name);
  const skillName =
    stringInput(input.skillName) ??
    stringInput(input.skill_name) ??
    stringInput(input.skill) ??
    stringInput(input.name) ??
    (isSkillTool && looksLikeSkillName(name) ? name : undefined);
  const source = stringInput(input.source) ?? stringInput(input.repository) ?? stringInput(input.repo);
  const mode = stringInput(input.mode) ?? stringInput(input.action) ?? (isSkillTool ? stringInput(input.command) : undefined);
  const args = getSkillArgs(input);

  if (!isSkillTool && !skillName && !source) return null;
  if (!skillName && !source && !mode && !args) return null;

  return {
    kind: "skill_operation",
    title: source ? "install skill" : "run skill",
    skillName,
    source,
    mode,
    details: compactStrings([
      stringInput(input.agent) ? `agent ${stringInput(input.agent)}` : undefined,
      stringInput(input.projectId) ? "project" : undefined,
    ]),
    args,
    props: getSkillProps(input, args),
  };
}

function getAdditionalProps(input: Record<string, unknown>, representedKeys: string[]): Record<string, unknown> | undefined {
  const represented = new Set(representedKeys);
  const props = Object.fromEntries(Object.entries(input).filter(([key]) => !represented.has(key)));
  return Object.keys(props).length > 0 ? props : undefined;
}

function getSkillProps(input: Record<string, unknown>, args: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  const representedKeys = new Set([...SKILL_ARG_METADATA_KEYS, "arguments", "args", "input", "properties"]);
  const representedValues = new Set([skillMetadataValues(input), args ? Object.values(args) : []].flat().map(normalizedDisplayValue));
  const props: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (representedKeys.has(key)) continue;
    if (representedValues.has(normalizedDisplayValue(value))) continue;
    props[key] = value;
  }

  if (isRecord(input.properties)) {
    for (const [key, value] of Object.entries(input.properties)) {
      if (representedKeys.has(key)) continue;
      if (representedValues.has(normalizedDisplayValue(value))) continue;
      if (key in props && sameDisplayValue(props[key], value)) continue;
      props[key] = value;
    }
  }

  return Object.keys(props).length > 0 ? props : undefined;
}

function skillMetadataValues(input: Record<string, unknown>): unknown[] {
  return [
    input.skillName,
    input.skill_name,
    input.skill,
    input.name,
    input.source,
    input.repository,
    input.repo,
    input.mode,
    input.action,
    input.command,
    input.agent,
    input.projectId,
  ];
}

function normalizedDisplayValue(value: unknown): string {
  return formatDisplayValue(value).trim();
}

function getSkillArgs(input: Record<string, unknown>): Record<string, unknown> | undefined {
  const explicitArgs = input.arguments ?? input.args ?? input.input;
  if (explicitArgs && typeof explicitArgs === "object" && !Array.isArray(explicitArgs)) {
    return explicitArgs as Record<string, unknown>;
  }

  const args = Object.fromEntries(Object.entries(input).filter(([key]) => !SKILL_ARG_METADATA_KEYS.has(key)));
  return Object.keys(args).length > 0 ? args : undefined;
}

function looksLikeSkillName(value: string): boolean {
  return value.startsWith("onezone-") || value.endsWith("-skill") || value.includes("project-memory");
}

function compactStrings(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function stringInput(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function numberDetail(label: string, value: unknown): string | undefined {
  return typeof value === "number" ? `${label} ${value}` : undefined;
}

function booleanDetail(label: string, value: unknown): string | undefined {
  return value === true ? label : undefined;
}

function rangeDetail(input: Record<string, unknown>): string | undefined {
  const start = input.startLine ?? input.start_line;
  const end = input.endLine ?? input.end_line;
  if (typeof start === "number" && typeof end === "number") return `lines ${start}-${end}`;
  return undefined;
}

function buildEditDiff(filePath: string | undefined, input: Record<string, unknown>): string | undefined {
  const edits = Array.isArray(input.edits) ? input.edits : [input];
  const chunks = edits.flatMap((edit, index) => {
    if (!edit || typeof edit !== "object") return [];
    const record = edit as Record<string, unknown>;
    const oldText = stringInput(record.old_string) ?? stringInput(record.old_str);
    const newText = stringInput(record.new_string) ?? stringInput(record.new_str);
    if (oldText === undefined && newText === undefined) return [];
    return [formatEditChunk(filePath, oldText ?? "", newText ?? "", edits.length > 1 ? index + 1 : undefined)];
  });

  return chunks.length > 0 ? chunks.join("\n") : undefined;
}

function formatEditChunk(filePath: string | undefined, oldText: string, newText: string, index: number | undefined): string {
  const label = filePath ?? "file";
  const suffix = index ? ` edit ${index}` : "";
  return [`--- ${label}${suffix}`, `+++ ${label}${suffix}`, "@@", prefixLines(oldText, "-"), prefixLines(newText, "+")]
    .filter(Boolean)
    .join("\n");
}

function prefixLines(text: string, prefix: string): string {
  return text.split("\n").map((line) => `${prefix}${line}`).join("\n");
}