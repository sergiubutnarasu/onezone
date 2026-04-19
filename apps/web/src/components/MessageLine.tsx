import type { RoomMessage } from '@/hooks/useTaskRoom';

export function MessageLine({ message }: { message: RoomMessage }) {
  const isAgent = message.role === 'agent';
  const isSystem = message.role === 'system';
  const isStderr = message.stream === 'stderr';

  const timestamp = new Date(message.ts).toLocaleTimeString();

  if (isSystem) {
    const hasExitCode = message.exitCode != null;
    const isSuccess = message.exitCode === 0;

    return (
      <div className="text-xs text-gray-400 italic py-0.5 px-2 flex items-center gap-2">
        <span>{timestamp}</span>
        {hasExitCode ? (
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium not-italic ${
              isSuccess ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'
            }`}
          >
            {isSuccess ? '✔ Done' : `✖ Error (${message.exitCode})`}
          </span>
        ) : (
          <span className="text-gray-600">▶</span>
        )}
        {(message.agentName || message.agentId) && (
          <span className="text-gray-500 not-italic font-medium">{message.agentName || message.agentId}</span>
        )}
        <span className="font-mono text-gray-400">{message.content}</span>
      </div>
    );
  }

  if (isAgent) {
    return (
      <div
        className={`font-mono text-sm py-0.5 px-2 ${
          isStderr ? 'text-red-400 bg-red-950/20' : 'text-green-300'
        }`}
      >
        <span className="text-gray-500 text-xs mr-2">{timestamp}</span>
        <span className="text-yellow-500 mr-2">[{message.agentName || message.agentId}]</span>
        <span className="text-gray-400 text-xs mr-2">{message.stream}</span>
        {message.content}
      </div>
    );
  }

  // user message
  return (
    <div className="py-1 px-2">
      <span className="text-gray-400 text-xs mr-2">{timestamp}</span>
      <span className="text-blue-400 font-medium mr-2">you</span>
      <span>{message.content}</span>
    </div>
  );
}
