'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchAgents } from '@/lib/api';
import type { Agent } from '@onezone/shared';

export default function AgentsPage() {
  const { data: agents = [], isLoading } = useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: fetchAgents,
    refetchInterval: 10_000,
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Projects
        </Link>
      </div>

      <h1 className="text-2xl font-bold mb-6">Agents</h1>

      {agents.length === 0 ? (
        <p className="text-gray-500">No agents registered yet.</p>
      ) : (
        <div className="space-y-3">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between border rounded-lg p-4 bg-white shadow-sm"
            >
              <div>
                <div className="font-medium">{agent.name}</div>
                <div className="text-sm text-gray-500">{agent.hostname}</div>
                <div className="text-xs text-gray-400 mt-1 font-mono">{agent.id}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1.5 text-sm font-medium px-2.5 py-0.5 rounded-full ${
                    agent.isConnected
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      agent.isConnected ? 'bg-green-500' : 'bg-gray-400'
                    }`}
                  />
                  {agent.isConnected ? 'Connected' : 'Disconnected'}
                </span>
                {agent.lastSeenAt && (
                  <span className="text-xs text-gray-400">
                    Last seen {new Date(agent.lastSeenAt).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
