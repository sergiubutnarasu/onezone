'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TaskStatus, TASK_STATUS_LABELS, TASK_STATUS_COLUMNS } from '@onezone/shared';

export function TaskStatusSelect() {
  const { setValue } = useFormContext<{ status: TaskStatus }>();
  const status = useWatch({ name: 'status' });

  return (
    <Select
      value={status}
      onValueChange={(v) => setValue('status', v as TaskStatus, { shouldValidate: true })}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TASK_STATUS_COLUMNS.map((s) => (
          <SelectItem key={s} value={s}>
            {TASK_STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
