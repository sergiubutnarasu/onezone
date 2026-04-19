import type { ConnectedAgent } from '@/hooks/useTaskRoom';

export function AgentStatusBar({ agents }: { agents: ConnectedAgent[] }) {
  if (agents.length === 0) {
    return (
      <div className="text-xs text-gray-500 px-4 py-1 border-b border-gray-700">
        No agents connected
      </div>
    );
  }

  return (
    <div className="flex gap-2 px-4 py-1 border-b border-gray-700 text-xs">
      <span className="text-gray-400">Agents:</span>
      {agents.map((a) => (
        <span
          key={a.agentId}
          className="bg-green-900 text-green-300 px-2 py-0.5 rounded-full"
        >
          {a.agentName}
        </span>
      ))}
    </div>
  );
}
