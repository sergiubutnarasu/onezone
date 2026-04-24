'use client';

import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateTask } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TaskStatus, type Task } from '@onezone/shared';
import { TaskStatusSelect } from './TaskStatusSelect';

interface EditTaskForm {
  name: string;
  description: string;
  status: TaskStatus;
}

interface EditTaskDialogProps {
  task: Task;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTaskDialog({ task, projectId, open, onOpenChange }: EditTaskDialogProps) {
  const qc = useQueryClient();

  const methods = useForm<EditTaskForm>({
    defaultValues: {
      name: task.name,
      description: task.description ?? '',
      status: task.status,
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = methods;

  const mutation = useMutation({
    mutationFn: (data: EditTaskForm) =>
      updateTask(task.id, {
        name: data.name,
        description: data.description,
        status: data.status,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['task', task.id] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: EditTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>
        <FormProvider {...methods}>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              {...register('name', { required: 'Name is required' })}
              placeholder="Task name"
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              {...register('description')}
              placeholder="Task description (optional)"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <TaskStatusSelect />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
