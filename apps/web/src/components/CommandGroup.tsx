'use client';

import { useState } from 'react';
import type { RoomMessage } from '@/hooks/useTaskRoom';

export interface CommandGroupData {
  jobId: string;
  command: string;
  agentName?: string | null;
  startTs: number;
  exitCode?: number;
  lines: RoomMessage[];
}

export function CommandGroup({ group }: { group: CommandGroupData }) {
  const [open, setOpen] = useState(true);

  const isDone = group.exitCode !== undefined;
  const failed = isDone && group.exitCode !== 0;
  const startTime = new Date(group.startTs).toLocaleTimeString();

  return (
    <div className="border border-gray-700 rounded mx-2 my-1 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-750 text-left"
      >
        <span className="text-gray-400 text-xs">{open ? '▾' : '▸'}</span>
        <span className="text-yellow-400 font-mono text-xs truncate flex-1">
          $ {group.command}
        </span>
        <span className="text-gray-500 text-xs shrink-0">{startTime}</span>
        {!isDone && (
          <span className="text-blue-400 text-xs shrink-0">running…</span>
        )}
        {isDone && (
          <span
            className={`text-xs shrink-0 px-1.5 py-0.5 rounded font-medium ${
              failed
                ? 'bg-red-900 text-red-300'
                : 'bg-green-900 text-green-300'
            }`}
          >
            {group.exitCode === -1 ? '✖ Interrupted' : failed ? `✖ Error (${group.exitCode})` : '✔ Done'}
          </span>
        )}
      </button>

      {/* Output lines */}
      {open && group.lines.length > 0 && (
        <div className="bg-gray-950 py-1">
          {group.lines.map((msg, i) => {
            const isStderr = msg.stream === 'stderr';
            return (
              <div
                key={msg.id || i}
                className={`font-mono text-xs px-3 py-0.5 whitespace-pre-wrap ${
                  isStderr ? 'text-red-400' : 'text-green-300'
                }`}
              >
                {msg.content}
              </div>
            );
          })}
        </div>
      )}

      {open && group.lines.length === 0 && isDone && (
        <div className="bg-gray-950 px-3 py-1 text-xs text-gray-600 italic">
          no output
        </div>
      )}
    </div>
  );
}
