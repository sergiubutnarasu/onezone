'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchProject, fetchTasks, createTask } from '@/lib/api';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import type { Task } from '@onezone/shared';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => fetchProject(id),
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', id],
    queryFn: () => fetchTasks(id),
  });

  const createMutation = useMutation({
    mutationFn: () => createTask(id, { name, description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      setName('');
      setDescription('');
      setShowForm(false);
    },
  });

  if (projectLoading || tasksLoading) return <div className="p-8">Loading...</div>;

  return (
    <div className="p-8">
      <div className="mb-4">
        <Link href="/" className="text-blue-600 hover:underline text-sm">
          ← Projects
        </Link>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project?.name}</h1>
          {project?.description && (
            <p className="text-gray-500 text-sm">{project.description}</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          New Task
        </button>
      </div>

      {showForm && (
        <div className="mb-6 p-4 border rounded bg-gray-50">
          <input
            className="block w-full border rounded px-3 py-2 mb-2"
            placeholder="Task name"
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

      <KanbanBoard tasks={tasks as Task[]} projectId={id} />
    </div>
  );
}
