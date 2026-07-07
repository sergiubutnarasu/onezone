"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AddMemoryButton } from "@/components/AddMemoryButton";
import { MemoryTreeItem } from "@/components/MemoryTreeItem";
import { buildMemoryTree } from "@/lib/memory-tree";
import {
  fetchMemoryFiles,
  fetchMemoryFile,
  writeMemoryFile,
  deleteMemoryFile,
} from "@/lib/api";

interface MemoryManagerProps {
  projectId: string;
}

export function MemoryManager({ projectId }: MemoryManagerProps) {
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const [hasFocusedEditor, setHasFocusedEditor] = useState(false);
  const [pendingSelectKey, setPendingSelectKey] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set(),
  );

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ["project-memory", projectId],
    queryFn: () => fetchMemoryFiles(projectId),
  });

  const keys = useMemo(() => filesData?.keys ?? [], [filesData?.keys]);
  const tree = useMemo(() => buildMemoryTree(keys), [keys]);
  const activeKey = selectedKey ?? keys[0] ?? null;

  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ["project-memory-file", projectId, activeKey],
    queryFn: () => fetchMemoryFile(projectId, activeKey!),
    enabled: !!activeKey,
  });

  const writeMutation = useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      writeMemoryFile(projectId, key, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-memory", projectId] });
      qc.invalidateQueries({
        queryKey: ["project-memory-file", projectId, activeKey],
      });
      setIsDirty(false);
      setHasFocusedEditor(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteMemoryFile(projectId, key),
    onSuccess: (_data, deletedKey) => {
      qc.invalidateQueries({ queryKey: ["project-memory", projectId] });
      if (activeKey === deletedKey) {
        setSelectedKey(null);
        setContent("");
        setIsDirty(false);
        setHasFocusedEditor(false);
      }
    },
  });

  const selectFile = useCallback((key: string) => {
    setSelectedKey(key);
    setContent("");
    setIsDirty(false);
    setHasFocusedEditor(false);
    setEditorKey((value) => value + 1);
  }, []);

  const handleSelectFile = useCallback(
    (key: string) => {
      if (isDirty && activeKey && activeKey !== key) {
        setPendingSelectKey(key);
        return;
      }
      selectFile(key);
    },
    [activeKey, isDirty, selectFile],
  );

  const handleConfirmDiscard = () => {
    if (!pendingSelectKey) return;
    selectFile(pendingSelectKey);
    setPendingSelectKey(null);
  };

  const handleSave = () => {
    if (!activeKey) return;
    writeMutation.mutate({ key: activeKey, content });
  };

  const handleDelete = (key: string) => {
    setDeleteKey(key);
  };

  const handleConfirmDelete = () => {
    if (!deleteKey) return;
    deleteMutation.mutate(deleteKey);
    setDeleteKey(null);
  };

  const handleMemoryCreated = (key: string, createdContent: string) => {
    setSelectedKey(key);
    setContent(createdContent);
    setIsDirty(false);
    setHasFocusedEditor(false);
    setEditorKey((value) => value + 1);
  };

  const currentFileContent = fileData?.content ?? "";
  const isLoadingFile = fileLoading && !!activeKey;
  const displayContent = isDirty ? content : currentFileContent;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background md:flex-row">
      <aside className="flex min-h-48 shrink-0 flex-col border-b border-border bg-card/30 md:min-h-0 md:w-60 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2">
          <div className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Memory ({keys.length})
            </h2>
          </div>
          <AddMemoryButton
            projectId={projectId}
            onCreated={handleMemoryCreated}
          />
        </div>

        {filesLoading ? (
          <div className="flex flex-col gap-2 p-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-3/4" />
          </div>
        ) : keys.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
            No memory files yet
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="flex flex-col gap-0.5 p-2">
              {tree.map((node) => (
                <MemoryTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  activeKey={activeKey}
                  expandedFolders={expandedFolders}
                  onToggleFolder={toggleFolder}
                  onSelectFile={handleSelectFile}
                  onDeleteFile={handleDelete}
                  isDeleting={deleteMutation.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="border-b border-border/60 bg-card/50 backdrop-blur-sm">
          <div className="flex min-h-16 items-center justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {activeKey ?? "Select a memory file"}
              </h1>
              {isDirty && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Unsaved changes
                </p>
              )}
            </div>
            {activeKey && (
              <div className="flex shrink-0 items-center gap-2">
                {isDirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsDirty(false);
                      setHasFocusedEditor(false);
                      setContent(currentFileContent);
                      setEditorKey((key) => key + 1);
                    }}
                  >
                    <X data-icon="inline-start" />
                    Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={
                    !isDirty || writeMutation.isPending || isLoadingFile
                  }
                >
                  {writeMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 p-5">
          {activeKey ? (
            isLoadingFile ? (
              <Skeleton className="h-full min-h-80 w-full" />
            ) : (
              <div
                className="h-full"
                onFocusCapture={() => setHasFocusedEditor(true)}
              >
                <RichTextEditor
                  key={`${activeKey}-${currentFileContent}-${editorKey}`}
                  value={displayContent}
                  onChange={(value) => {
                    setContent(value);
                    if (hasFocusedEditor) {
                      setIsDirty(value !== currentFileContent);
                    }
                  }}
                  placeholder="Memory content..."
                  className="h-full"
                  minHeight="100%"
                />
              </div>
            )
          ) : (
            <div className="flex h-full min-h-80 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Select a memory file or add a new one
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={!!pendingSelectKey}
        onOpenChange={(open) => {
          if (!open) setPendingSelectKey(null);
        }}
        title="Discard changes?"
        description="You have unsaved changes in this memory file. Switching files will discard them."
        confirmLabel="Discard"
        onConfirm={handleConfirmDiscard}
      />

      <ConfirmDialog
        open={!!deleteKey}
        onOpenChange={(open) => {
          if (!open) setDeleteKey(null);
        }}
        title="Delete memory file?"
        description={
          deleteKey ? `Delete "${deleteKey}"? This cannot be undone.` : ""
        }
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
