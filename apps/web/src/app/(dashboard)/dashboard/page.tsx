'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface BoardData {
  [stage: string]: Array<{ _id: string; title: string; progressPct: number; targetDate?: string }>;
}

interface ApprovalsSummary {
  count: number;
  list: Array<{ _id: string; kind: string; project: { title: string }; requestedBy: { name: string } }>;
}

interface BlockerSummary {
  _id: string; title: string; type: string; status: string; project?: { title: string };
}

interface WorkloadItem { userId: string; userName: string; totalTasks: number; inProgress: number; }
interface StageDuration { stageName: string; avgHours: number; count: number; }

export default function DashboardOverviewPage() {
  const board = useQuery<BoardData>({
    queryKey: ['dashboard-board'],
    queryFn: () => apiClient.get('/dashboard/board').then((r) => r.data),
  });
  const approvals = useQuery<ApprovalsSummary>({
    queryKey: ['dashboard-approvals'],
    queryFn: () => apiClient.get('/dashboard/approvals-pending').then((r) => r.data),
  });
  const blockers = useQuery<BlockerSummary[]>({
    queryKey: ['dashboard-blockers'],
    queryFn: () => apiClient.get('/dashboard/blockers').then((r) => r.data),
  });
  const workload = useQuery<WorkloadItem[]>({
    queryKey: ['dashboard-workload'],
    queryFn: () => apiClient.get('/dashboard/workload').then((r) => r.data),
  });
  const stageDurations = useQuery<StageDuration[]>({
    queryKey: ['dashboard-stage-durations'],
    queryFn: () => apiClient.get('/dashboard/stage-durations').then((r) => r.data),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending Approvals" value={approvals.data?.count ?? '—'} color="blue" />
        <StatCard label="Open Blockers" value={blockers.data?.filter((b) => b.status === 'open').length ?? '—'} color="red" />
        <StatCard label="Active Stages" value={board.data ? Object.keys(board.data).length : '—'} color="green" />
      </div>

      {/* Board view */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Projects by Stage</h2>
        {board.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {board.data && (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Object.entries(board.data).map(([stage, projects]) => (
              <div key={stage} className="min-w-[220px] bg-white rounded-lg border border-gray-200 p-3">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  {stage} <span className="text-gray-400">({projects.length})</span>
                </h3>
                <div className="space-y-2">
                  {projects.map((p) => (
                    <div key={p._id} className="bg-gray-50 rounded p-2 text-xs">
                      <p className="font-medium text-gray-800 truncate">{p.title}</p>
                      <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${p.progressPct}%` }} />
                      </div>
                      <p className="text-gray-500 mt-0.5">{p.progressPct}% complete</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Workload chart */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Team Workload</h2>
        {workload.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {workload.data && workload.data.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={workload.data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="userName" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalTasks" name="Total Tasks" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !workload.isLoading && <p className="text-sm text-gray-400">No workload data yet.</p>
        )}
      </section>

      {/* Stage durations chart */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Average Stage Duration (hours)</h2>
        {stageDurations.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {stageDurations.data && stageDurations.data.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={stageDurations.data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="stageName" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => [`${v}h`, 'Avg Duration']} />
                <Bar dataKey="avgHours" name="Avg Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          !stageDurations.isLoading && <p className="text-sm text-gray-400">No stage duration data yet.</p>
        )}
      </section>

      {/* Pending approvals */}
      <section>
        <h2 className="text-lg font-semibold text-gray-700 mb-3">Pending Approvals</h2>
        {approvals.data?.list.length === 0 && <p className="text-sm text-gray-400">No pending approvals.</p>}
        <div className="bg-white rounded-lg border border-gray-200 divide-y">
          {approvals.data?.list.map((a) => (
            <div key={a._id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">{a.project?.title}</p>
                <p className="text-xs text-gray-500">
                  {a.kind.replace('_', ' ')} · requested by {a.requestedBy?.name}
                </p>
              </div>
              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">Pending</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    green: 'bg-green-50 text-green-700',
  };
  return (
    <div className={`rounded-xl p-4 ${colors[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  );
}
