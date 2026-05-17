"use client";

import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  updateTask,
  assignTaskTerminal,
  deleteTask,
  updateTaskColumn,
  setTaskCompleted,
} from "@/lib/api";
import { COMPLETED_COLUMN_ID, type Task } from "@onezone/shared";

export function useTaskMutations(
  task: Task,
  projectId: string,
  onDeleted: () => void,
) {
  const qc = useQueryClient();

  const assignMutation = useMutation({
    mutationFn: (terminalId: string) =>
      assignTaskTerminal(task.id, terminalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const columnMutation = useMutation({
    mutationFn: async (columnId: string | null) => {
      if (columnId === COMPLETED_COLUMN_ID) {
        return setTaskCompleted(task.id, true);
      }
      if (task.completedAt) {
        await setTaskCompleted(task.id, false);
      }
      return updateTaskColumn(task.id, columnId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const agentMutation = useMutation({
    mutationFn: (agentId: string) => updateTask(task.id, { agentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["task", task.id] });
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      onDeleted();
    },
  });

  return {
    assignMutation,
    columnMutation,
    agentMutation,
    deleteMutation,
  };
}
