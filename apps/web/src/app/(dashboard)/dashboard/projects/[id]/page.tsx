'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ProjectChat } from '@/components/chat/ProjectChat';
import type { Project, Task } from '@ti/shared';

interface Props {
  params: { id: string };
}

export default function ProjectDetailPage({ params }: Props) {
  const { id } = params;

  const { data: project, isLoading: loadingProject } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then((r) => r.data),
  });

  const { data: tasks, isLoading: loadingTasks } = useQuery<Task[]>({
    queryKey: ['tasks', id],
    queryFn: () => apiClient.get(`/projects/${id}/tasks`).then((r) => r.data),
  });

  if (loadingProject) return <p className="text-sm text-gray-500">Loading project…</p>;
  if (!project) return <p className="text-sm text-red-500">Project not found.</p>;

  const statusColor: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    on_hold: 'bg-yellow-100 text-yellow-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[project.status] ?? 'bg-gray-100 text-gray-700'}`}
            >
              {project.status}
            </span>
            <span className="text-sm text-gray-500">Progress: {project.progressPct ?? 0}%</span>
          </div>
        </div>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${project.progressPct ?? 0}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Tasks</h2>
          {loadingTasks ? (
            <p className="text-sm text-gray-400">Loading tasks…</p>
          ) : tasks?.length === 0 ? (
            <p className="text-sm text-gray-400">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks?.map((task) => {
                const dot: Record<string, string> = {
                  done: 'bg-green-500',
                  in_progress: 'bg-blue-500',
                  blocked: 'bg-red-500',
                  pending: 'bg-gray-400',
                };
                return (
                  <div
                    key={task._id}
                    className="flex items-start gap-3 bg-white border border-gray-200 rounded px-3 py-2"
                  >
                    <span
                      className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dot[task.status] ?? 'bg-gray-400'}`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-800">{task.title}</p>
                      <p className="text-xs text-gray-500 capitalize">{task.status.replace('_', ' ')}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Team Chat</h2>
          <ProjectChat projectId={id} />
        </div>
      </div>
    </div>
  );
}
