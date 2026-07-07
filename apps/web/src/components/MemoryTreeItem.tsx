"use client";

import { ChevronRight, FileText, Folder, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MemoryTreeNode } from "@/lib/memory-tree";

interface MemoryTreeItemProps {
  node: MemoryTreeNode;
  depth: number;
  activeKey: string | null;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  onSelectFile: (key: string) => void;
  onDeleteFile: (key: string) => void;
  isDeleting: boolean;
}

export function MemoryTreeItem({
  node,
  depth,
  activeKey,
  expandedFolders,
  onToggleFolder,
  onSelectFile,
  onDeleteFile,
  isDeleting,
}: MemoryTreeItemProps) {
  const indent = { paddingLeft: 12 + depth * 16 };

  if (node.type === "folder") {
    const isCollapsed = !expandedFolders.has(node.path);
    return (
      <div>
        <div
          role="button"
          tabIndex={0}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-3 text-left text-sm text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          style={indent}
          onClick={() => onToggleFolder(node.path)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onToggleFolder(node.path);
            }
          }}
        >
          <ChevronRight
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              !isCollapsed && "rotate-90",
            )}
          />
          <Folder className="size-3.5 shrink-0" />
          <span className="truncate font-medium">{node.name}</span>
        </div>
        {!isCollapsed &&
          node.children?.map((child) => (
            <MemoryTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activeKey={activeKey}
              expandedFolders={expandedFolders}
              onToggleFolder={onToggleFolder}
              onSelectFile={onSelectFile}
              onDeleteFile={onDeleteFile}
              isDeleting={isDeleting}
            />
          ))}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group flex w-full cursor-pointer items-center justify-between gap-2 rounded-md py-2 pr-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        activeKey === node.path
          ? "bg-accent text-accent-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
      style={indent}
      onClick={() => onSelectFile(node.path)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectFile(node.path);
        }
      }}
    >
      <span className="flex min-w-0 items-center gap-2">
        <FileText className="size-3.5 shrink-0" />
        <span className="truncate">{node.name}</span>
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        className="shrink-0 text-muted-foreground opacity-100 hover:text-destructive md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
        onClick={(event) => {
          event.stopPropagation();
          onDeleteFile(node.path);
        }}
        disabled={isDeleting}
        title={`Delete ${node.path}`}
      >
        <Trash2 />
      </Button>
    </div>
  );
}
