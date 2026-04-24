'use client';

import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createTask } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Terminal } from '@onezone/shared';

interface CreateTaskForm {
  name: string;
  description: string;
  terminalId: string;
}

interface CreateTaskDialogProps {
  projectId: string;
  terminals: Terminal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateTaskDialog({ projectId, terminals, open, onOpenChange }: CreateTaskDialogProps) {
  const qc = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskForm>({
    defaultValues: {
      name: '',
      description: '',
      terminalId: '',
    },
  });

  const terminalId = watch('terminalId');

  const mutation = useMutation({
    mutationFn: (data: CreateTaskForm) =>
      createTask(projectId, {
        name: data.name,
        description: data.description,
        terminalId: data.terminalId,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      onOpenChange(false);
      reset();
    },
  });

  const onSubmit = (data: CreateTaskForm) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create task</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 pt-2">
          <Input
            {...register('name', { required: 'Name is required' })}
            placeholder="Task name"
            autoFocus
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <Input
            {...register('description')}
            placeholder="Description (optional)"
          />
          <Select
            value={terminalId}
            onValueChange={(v) => v != null && setValue('terminalId', v, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {(v: string) => v
                  ? (terminals.find((t) => t.id === v)?.name ?? v)
                  : <span className="text-muted-foreground">Select a terminal</span>
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {terminals.map((t) => (
                <SelectItem key={t.id} value={t.id} label={t.name}>
                  <span className={`mr-1.5 ${t.isConnected ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {t.isConnected ? '●' : '○'}
                  </span>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={isSubmitting || mutation.isPending || !terminalId}
            className="w-full mt-1"
          >
            {mutation.isPending ? 'Creating…' : 'Create task'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
