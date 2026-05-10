'use client';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createKanbanColumn, updateKanbanColumn } from '@/lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface KanbanColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** When provided, the dialog is in edit mode */
  column?: { id: string; name: string; description: string | null };
}

interface FormValues {
  name: string;
  description: string;
}

export function KanbanColumnDialog({ open, onOpenChange, projectId, column }: KanbanColumnDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!column;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: { name: column?.name ?? '', description: column?.description ?? '' },
  });

  useEffect(() => {
    if (open) {
      reset({ name: column?.name ?? '', description: column?.description ?? '' });
    }
  }, [open, column, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateKanbanColumn(projectId, column!.id, { name: data.name, description: data.description || undefined })
        : createKanbanColumn(projectId, { name: data.name, description: data.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kanban-columns', projectId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit column' : 'Add column'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="col-name" className="text-sm font-medium">Name</label>
            <Input
              id="col-name"
              placeholder="e.g. In Progress"
              {...register('name', { required: 'Name is required' })}
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="col-description" className="text-sm font-medium">Description <span className="text-muted-foreground">(optional)</span></label>
            <Textarea
              id="col-description"
              placeholder="What does this column represent?"
              rows={2}
              {...register('description')}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? 'Save' : 'Add column'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
