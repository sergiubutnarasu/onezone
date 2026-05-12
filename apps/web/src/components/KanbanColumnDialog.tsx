"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { createKanbanColumn, updateKanbanColumn } from "@/lib/api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";

interface KanbanColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  /** When provided, the dialog is in edit mode */
  column?: { id: string; name: string; instructions: string | null };
}

interface FormValues {
  name: string;
  instructions: string;
}

export function KanbanColumnDialog({
  open,
  onOpenChange,
  projectId,
  column,
}: KanbanColumnDialogProps) {
  const qc = useQueryClient();
  const isEdit = !!column;
  const [editorKey, setEditorKey] = useState(0);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      name: column?.name ?? "",
      instructions: column?.instructions ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: column?.name ?? "",
        instructions: column?.instructions ?? "",
      });
      setEditorKey((k) => k + 1);
    }
  }, [open, column, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormValues) =>
      isEdit
        ? updateKanbanColumn(projectId, column!.id, {
            name: data.name,
            instructions: data.instructions || undefined,
          })
        : createKanbanColumn(projectId, {
            name: data.name,
            instructions: data.instructions || undefined,
          }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kanban-columns", projectId] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit column" : "Add column"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label htmlFor="col-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="col-name"
              placeholder="e.g. In Progress"
              {...register("name", { required: "Name is required" })}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Instructions</label>
            <Controller
              name="instructions"
              control={control}
              render={({ field }) => (
                <RichTextEditor
                  key={editorKey}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder="Define instruction for this column"
                />
              )}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isEdit ? "Save" : "Add column"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
