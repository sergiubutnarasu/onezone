"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { writeMemoryFile } from "@/lib/api";

interface AddMemoryDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (key: string, content: string) => void;
}

export function AddMemoryDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: AddMemoryDialogProps) {
  const qc = useQueryClient();
  const [newKey, setNewKey] = useState("");
  const [newContent, setNewContent] = useState("");

  const createMutation = useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      writeMemoryFile(projectId, key, content),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project-memory", projectId] });
      qc.invalidateQueries({
        queryKey: ["project-memory-file", projectId, variables.key],
      });
      onCreated(variables.key, variables.content);
      onOpenChange(false);
    },
  });

  const handleCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const key = newKey.trim();
    if (!key) return;
    createMutation.mutate({ key, content: newContent });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add memory</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="contents">
          <DialogBody>
            <div className="flex flex-col gap-3 py-1">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium" htmlFor="memory-file-name">
                  File name
                </label>
                <Input
                  id="memory-file-name"
                  value={newKey}
                  onChange={(event) => setNewKey(event.target.value)}
                  placeholder="notes.md"
                  autoFocus
                />
              </div>
              <div className="flex min-h-80 flex-col gap-1">
                <label className="text-sm font-medium">Content</label>
                <RichTextEditor
                  value={newContent}
                  onChange={setNewContent}
                  placeholder="Memory content..."
                  className="h-80"
                  minHeight="100%"
                />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button
              type="submit"
              disabled={!newKey.trim() || createMutation.isPending}
            >
              {createMutation.isPending ? "Adding…" : "Add memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}