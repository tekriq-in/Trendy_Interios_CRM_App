'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { CheckSquare, AlertTriangle, FolderKanban, type LucideIcon } from 'lucide-react';
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
  const board = useQuery<BoardData>({ queryKey: ['dashboard-board'], queryFn: () => apiClient.get('/dashboard/board').then(r => r.data) });
  const approvals = useQuery<ApprovalsSummary>({ queryKey: ['dashboard-approvals'], queryFn: () => apiClient.get('/dashboard/approvals-pending').then(r => r.data) });
  const blockers = useQuery<BlockerSummary[]>({ queryKey: ['dashboard-blockers'], queryFn: () => apiClient.get('/dashboard/blockers').then(r => r.data) });
  const workload = useQuery<WorkloadItem[]>({ queryKey: ['dashboard-workload'], queryFn: () => apiClient.get('/dashboard/workload').then(r => r.data) });
  const stageDurations = useQuery<StageDuration[]>({ queryKey: ['dashboard-stage-durations'], queryFn: () => apiClient.get('/dashboard/stage-durations').then(r => r.data) });

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={CheckSquare} label="Pending Approvals" value={approvals.data?.count ?? '—'} iconBg="bg-yellow-50" iconColor="text-yellow-600" />
        <StatCard icon={AlertTriangle} label="Open Blockers" value={blockers.data?.filter(b => b.status === 'open').length ?? '—'} iconBg="bg-red-50" iconColor="text-red-600" />
        <StatCard icon={FolderKanban} label="Active Stages" value={board.data ? Object.keys(board.data).length : '—'} iconBg="bg-indigo-50" iconColor="text-indigo-600" />
      </div>

      {/* Board kanban */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Projects by Stage</h2>
        {board.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
        {board.data && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Object.entries(board.data).map(([stage, projects], i) => {
              const colors = ['bg-indigo-500','bg-violet-500','bg-sky-500','bg-emerald-500','bg-amber-500','bg-rose-500','bg-teal-500','bg-orange-500'];
              const color = colors[i % colors.length];
              return (
                <div key={stage} className="min-w-[200px] bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden shrink-0">
                  <div className={`${color} px-3 py-2`}>
                    <p className="text-white text-xs font-semibold">{stage}</p>
                    <p className="text-white/70 text-xs">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="p-2 space-y-1.5">
                    {projects.map(p => (
                      <div key={p._id} className="bg-slate-50 rounded-lg p-2">
                        <p className="text-xs font-medium text-slate-800 truncate">{p.title}</p>
                        <div className="mt-1.5 h-1 bg-slate-200 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${p.progressPct}%` }} />
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{p.progressPct}%</p>
                      </div>
                    ))}
                    {projects.length === 0 && <p className="text-xs text-slate-400 py-2 text-center">Empty</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Team Workload</h2>
          {workload.data && workload.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={workload.data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="userName" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="totalTasks" name="Total" fill="#6366f1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No workload data yet.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Avg Stage Duration (hrs)</h2>
          {stageDurations.data && stageDurations.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageDurations.data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stageName" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v) => [`${v}h`, 'Avg']} />
                <Bar dataKey="avgHours" name="Avg Hours" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No stage duration data yet.</p>
          )}
        </div>
      </div>

      {/* Pending approvals */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Pending Approvals</h2>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {approvals.data?.list.map(a => (
            <div key={a._id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.project?.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {a.kind.replace(/_/g, ' ')} · {a.requestedBy?.name}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-yellow-50 text-yellow-700 ring-1 ring-inset ring-yellow-600/20">
                Pending
              </span>
            </div>
          ))}
          {!approvals.isLoading && approvals.data?.list.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No pending approvals.</div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: LucideIcon; label: string; value: string | number; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-6 h-6 ${iconColor}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
