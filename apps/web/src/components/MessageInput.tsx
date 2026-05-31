'use client';

import { useState, FormEvent } from 'react';
import { SendHorizonal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function MessageInput({
  onSend,
  disabled,
}: {
  onSend: (content: string) => void | boolean | Promise<boolean>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);
    let sent: void | boolean = false;
    try {
      sent = await onSend(trimmed);
    } finally {
      setIsSending(false);
    }

    // Keep the text if delivery fails so the user can retry the same command.
    if (sent !== false) {
      setValue('');
    }
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
        disabled={disabled || isSending}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        type="submit"
        size="icon"
        disabled={disabled || isSending || !value.trim()}
      >
        <SendHorizonal />
      </Button>
    </form>
  );
}
