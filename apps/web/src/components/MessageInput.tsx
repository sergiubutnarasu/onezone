'use client';

import { useState, FormEvent } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue('');
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex gap-2 p-3 border-t border-border/50 bg-card/30"
    >
      <Input
        className="flex-1 font-mono text-sm bg-muted/30 border-border/50 focus-visible:border-primary/50"
        placeholder={disabled ? 'Connecting…' : '$ Enter message or command…'}
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || !value.trim()}
      >
        <SendHorizonal />
      </Button>
    </form>
  );
}
