'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchProjects, createProject } from '@/lib/api';

export default function ProjectsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  });

  const createMutation = useMutation({
    mutationFn: () => createProject({ name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setName('');
      setDescription('');
      setShowForm(false);
    },
  });

  if (isLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <div className="flex gap-2">
          <Link href="/agents" className="text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded border hover:bg-gray-50">
            Agents
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            New Project
          </button>
        </div>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <input
            className="block w-full border rounded px-3 py-2 mb-2"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="block w-full border rounded px-3 py-2 mb-3"
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <button
            onClick={() => createMutation.mutate()}
            disabled={!name || createMutation.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create'}
          </button>
        </div>
      )}

      {projects.length === 0 ? (
        <p className="text-gray-500">No projects yet. Create one to get started.</p>
      ) : (
        <ul className="space-y-3">
          {projects.map((p: { id: string; name: string; description?: string; createdAt: string }) => (
            <li key={p.id} className="border rounded p-4 hover:bg-gray-50">
              <Link href={`/projects/${p.id}`} className="block">
                <div className="font-medium text-blue-700">{p.name}</div>
                {p.description && (
                  <div className="text-sm text-gray-500">{p.description}</div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
