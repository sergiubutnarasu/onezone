'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Plus, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  fetchMemoryFiles,
  fetchMemoryFile,
  writeMemoryFile,
  deleteMemoryFile,
} from '@/lib/api';

interface MemoryManagerProps {
  projectId: string;
}

export function MemoryManager({ projectId }: MemoryManagerProps) {
  const qc = useQueryClient();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [newKey, setNewKey] = useState('');
  const [content, setContent] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  const { data: filesData, isLoading: filesLoading } = useQuery({
    queryKey: ['project-memory', projectId],
    queryFn: () => fetchMemoryFiles(projectId),
  });

  const { data: fileData, isLoading: fileLoading } = useQuery({
    queryKey: ['project-memory-file', projectId, selectedKey],
    queryFn: () => fetchMemoryFile(projectId, selectedKey!),
    enabled: !!selectedKey,
  });

  const writeMutation = useMutation({
    mutationFn: ({ key, content }: { key: string; content: string }) =>
      writeMemoryFile(projectId, key, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-memory', projectId] });
      qc.invalidateQueries({ queryKey: ['project-memory-file', projectId, selectedKey] });
      setIsDirty(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => deleteMemoryFile(projectId, key),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-memory', projectId] });
      if (selectedKey) {
        setSelectedKey(null);
        setContent('');
        setIsDirty(false);
      }
    },
  });

  const handleSelectFile = useCallback(
    (key: string) => {
      if (isDirty && selectedKey && selectedKey !== key) {
        if (!window.confirm('You have unsaved changes. Discard them?')) {
          return;
        }
      }
      setSelectedKey(key);
      setContent('');
      setIsDirty(false);
    },
    [isDirty, selectedKey],
  );

  const handleCreate = () => {
    const key = newKey.trim();
    if (!key) return;
    writeMutation.mutate({ key, content: '' }, {
      onSuccess: () => {
        setNewKey('');
        setSelectedKey(key);
        setContent('');
        setIsDirty(false);
      },
    });
  };

  const handleSave = () => {
    if (!selectedKey) return;
    writeMutation.mutate({ key: selectedKey, content });
  };

  const handleDelete = (key: string) => {
    if (!window.confirm(`Delete "${key}"?`)) return;
    deleteMutation.mutate(key);
  };

  // Sync content when file data loads
  const currentFileContent = fileData?.content ?? '';
  const isLoadingFile = fileLoading && !!selectedKey;

  // Only auto-set content from query when not dirty and not actively loading
  // We use a ref-like pattern: if selectedKey changes, reset content
  // But we can't use useEffect easily without causing loops. Instead, we'll
  // show content from query directly when not dirty.
  const displayContent = isDirty ? content : currentFileContent;

  const keys = filesData?.keys ?? [];

  return (
    <div className="flex flex-col gap-3">
      {/* Create new file */}
      <div className="flex gap-2">
        <Input
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          placeholder="New memory file key (e.g. notes.md)"
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        <Button
          size="icon"
          onClick={handleCreate}
          disabled={!newKey.trim() || writeMutation.isPending}
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* File list */}
      {filesLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : keys.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No memory files yet
        </p>
      ) : (
        <ScrollArea className="max-h-40 border rounded-md">
          <div className="flex flex-col">
            {keys.map((key) => (
              <div
                key={key}
                className={`flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-accent ${
                  selectedKey === key ? 'bg-accent' : ''
                }`}
                onClick={() => handleSelectFile(key)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="size-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{key}</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive size-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(key);
                  }}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Editor */}
      {selectedKey && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium truncate">{selectedKey}</p>
            <div className="flex gap-1">
              {isDirty && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsDirty(false);
                    setContent(currentFileContent);
                  }}
                >
                  <X className="size-3.5 mr-1" />
                  Reset
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || writeMutation.isPending}
              >
                <Save className="size-3.5 mr-1" />
                {writeMutation.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
          <Textarea
            value={displayContent}
            onChange={(e) => {
              setContent(e.target.value);
              setIsDirty(true);
            }}
            placeholder="File content..."
            className="min-h-45 font-mono text-sm"
            disabled={isLoadingFile}
          />
        </div>
      )}
    </div>
  );
}
