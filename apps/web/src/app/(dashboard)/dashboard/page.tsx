'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import {
  CheckSquare, AlertTriangle, FolderKanban, Users, UserCircle2, type LucideIcon,
} from 'lucide-react';
import { SkeletonDeptCard } from '@/components/ui/Skeleton';
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
interface BlockerSummary { _id: string; title: string; type: string; status: string; project?: { title: string }; }
interface WorkloadItem { userId: string; userName: string; totalTasks: number; inProgress: number; }
interface StageDuration { stageName: string; avgHours: number; count: number; }
interface Dept { _id: string; name: string; order: number; defaultSlaHours: number; }
interface Employee { _id: string; name: string; department?: { _id: string } | string; isActive: boolean; }
interface Client { _id: string; }
interface SlaReportRow { projectId: string; projectTitle: string; stageName: string; hoursInStage: number; slaHours: number; breached: boolean; }

const DEPT_COLORS = ['#6366f1','#8b5cf6','#0ea5e9','#10b981','#f59e0b','#f43f5e','#14b8a6','#f97316'];

export default function DashboardOverviewPage() {
  const router = useRouter();
  const board   = useQuery<BoardData>({ queryKey: ['dashboard-board'], queryFn: () => apiClient.get('/dashboard/board').then(r => r.data) });
  const approvals = useQuery<ApprovalsSummary>({ queryKey: ['dashboard-approvals'], queryFn: () => apiClient.get('/dashboard/approvals-pending').then(r => r.data) });
  const blockers  = useQuery<BlockerSummary[]>({ queryKey: ['dashboard-blockers'], queryFn: () => apiClient.get('/dashboard/blockers').then(r => r.data) });
  const workload  = useQuery<WorkloadItem[]>({ queryKey: ['dashboard-workload'], queryFn: () => apiClient.get('/dashboard/workload').then(r => r.data) });
  const stageDurations = useQuery<StageDuration[]>({ queryKey: ['dashboard-stage-durations'], queryFn: () => apiClient.get('/dashboard/stage-durations').then(r => r.data) });
  const departments = useQuery<Dept[]>({ queryKey: ['departments'], queryFn: () => apiClient.get('/departments').then(r => r.data) });
  const employees   = useQuery<Employee[]>({ queryKey: ['users'], queryFn: () => apiClient.get('/users').then(r => r.data) });
  const clients     = useQuery<Client[]>({ queryKey: ['clients', ''], queryFn: () => apiClient.get('/clients').then(r => r.data) });
  const slaReport   = useQuery<SlaReportRow[]>({ queryKey: ['sla-report'], queryFn: () => apiClient.get('/sla/report').then(r => r.data).catch(() => [] as SlaReportRow[]) });

  const sortedDepts = [...(departments.data ?? [])].sort((a, b) => a.order - b.order);

  // Map stageName → number of breached projects
  const slaBreachByStage = new Map<string, number>();
  for (const row of slaReport.data ?? []) {
    if (row.breached) slaBreachByStage.set(row.stageName, (slaBreachByStage.get(row.stageName) ?? 0) + 1);
  }

  const openBlockerCount = (blockers.data ?? []).filter(b => b.status === 'open').length;
  const totalProjects = Object.values(board.data ?? {}).reduce((s, arr) => s + arr.length, 0);
  const activeEmployees = (employees.data ?? []).filter(e => e.isActive).length;

  return (
    <div className="space-y-8">
      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={UserCircle2}  label="Clients"           value={clients.data?.length ?? '—'}     iconBg="bg-violet-50"  iconColor="text-violet-600" />
        <StatCard icon={FolderKanban} label="Active Projects"   value={totalProjects}                   iconBg="bg-indigo-50"  iconColor="text-indigo-600" />
        <StatCard icon={CheckSquare}  label="Pending Approvals" value={approvals.data?.count ?? '—'}    iconBg="bg-amber-50"   iconColor="text-amber-600" />
        <StatCard icon={AlertTriangle} label="Open Blockers"    value={openBlockerCount}                iconBg="bg-red-50"     iconColor="text-red-600" />
      </div>

      {/* ── Department overview ── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-800">All Departments</h2>
          <span className="text-xs text-slate-400">{sortedDepts.length} departments · {activeEmployees} staff</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {departments.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonDeptCard key={i} />)
            : sortedDepts.map((dept, idx) => {
            const color = DEPT_COLORS[idx % DEPT_COLORS.length];
            const projectsHere = (board.data ?? {})[dept.name] ?? [];
            const staffHere = (employees.data ?? []).filter(e => {
              const d = e.department;
              if (!d) return false;
              return typeof d === 'object' ? d._id === dept._id : d === dept._id;
            });
            const blockersHere = (blockers.data ?? []).filter(b =>
              b.status === 'open' && projectsHere.some(p => p._id === (b.project as unknown as { _id: string })?._id)
            );

            const slaBreachCount = slaBreachByStage.get(dept.name) ?? 0;
            return (
              <div key={dept._id} className={`bg-white border rounded-xl overflow-hidden hover:border-slate-300 transition-colors ${slaBreachCount > 0 ? 'border-red-300' : 'border-slate-200'}`}>
                <div className="h-1.5 w-full" style={{ background: slaBreachCount > 0 ? '#ef4444' : color }} />
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Stage {dept.order}</div>
                      <div className="font-semibold text-slate-900 text-sm mt-0.5">{dept.name}</div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs px-2 py-0.5 rounded-full font-semibold text-slate-500 bg-slate-100">
                        SLA {dept.defaultSlaHours}h
                      </div>
                      {slaBreachCount > 0 && (
                        <div className="text-xs px-2 py-0.5 rounded-full font-semibold text-red-700 bg-red-100 ring-1 ring-inset ring-red-200 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                          {slaBreachCount} SLA breach{slaBreachCount > 1 ? 'es' : ''}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold" style={{ color }}>{projectsHere.length}</div>
                      <div className="text-xs text-slate-400">projects</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-slate-700">{staffHere.length}</div>
                      <div className="text-xs text-slate-400">staff</div>
                    </div>
                    <div>
                      <div className={`text-lg font-bold ${blockersHere.length > 0 ? 'text-red-500' : 'text-slate-300'}`}>{blockersHere.length}</div>
                      <div className="text-xs text-slate-400">blockers</div>
                    </div>
                  </div>

                  {/* Staff avatars */}
                  {staffHere.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {staffHere.slice(0, 5).map(emp => (
                        <div key={emp._id} className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 text-xs font-bold" title={emp.name}>
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                      ))}
                      {staffHere.length > 5 && (
                        <div className="text-xs text-slate-400">+{staffHere.length - 5}</div>
                      )}
                    </div>
                  )}

                  {/* Projects in this dept */}
                  {projectsHere.length > 0 && (
                    <div className="space-y-1">
                      {projectsHere.slice(0, 3).map(p => (
                        <button
                          key={p._id}
                          onClick={() => router.push(`/dashboard/projects/${p._id}`)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5 hover:bg-slate-100 transition-colors">
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-slate-700 truncate">{p.title}</div>
                              <div className="h-1 bg-slate-200 rounded-full mt-1 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${p.progressPct}%`, background: color }} />
                              </div>
                            </div>
                            <div className="text-xs text-slate-400 shrink-0">{p.progressPct}%</div>
                          </div>
                        </button>
                      ))}
                      {projectsHere.length > 3 && (
                        <div className="text-xs text-slate-400 text-center pt-0.5">+{projectsHere.length - 3} more</div>
                      )}
                    </div>
                  )}
                  {projectsHere.length === 0 && (
                    <div className="text-xs text-slate-300 text-center py-1">No active projects</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Team Workload</h2>
          {workload.data && workload.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={workload.data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="userName" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="totalTasks" name="Total" fill="#6366f1" radius={[4,4,0,0]} />
                <Bar dataKey="inProgress" name="In Progress" fill="#f59e0b" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No workload data yet.</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Avg Stage Duration (hrs)</h2>
          {stageDurations.data && stageDurations.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stageDurations.data} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="stageName" tick={{ fontSize: 10, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => [`${v}h`, 'Avg']} />
                <Bar dataKey="avgHours" name="Avg Hours" fill="#10b981" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 text-center py-10">No stage data yet.</p>
          )}
        </div>
      </div>

      {/* ── Pending approvals ── */}
      <section>
        <h2 className="text-base font-semibold text-slate-800 mb-3">Pending Approvals</h2>
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {approvals.data?.list.map(a => (
            <div key={a._id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-800">{a.project?.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{a.kind.replace(/_/g, ' ')} · {a.requestedBy?.name}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20">Pending</span>
            </div>
          ))}
          {!approvals.isLoading && (approvals.data?.list.length ?? 0) === 0 && (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No pending approvals.</div>
          )}
        </div>
      </section>

      {/* ── Open blockers ── */}
      {openBlockerCount > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Open Blockers</h2>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {(blockers.data ?? []).filter(b => b.status === 'open').map(b => (
              <div key={b._id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{b.title}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{b.project?.title} · {b.type.replace('_', ' ')}</p>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-red-50 text-red-600 shrink-0">open</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, iconBg, iconColor }: {
  icon: LucideIcon; label: string; value: string | number; iconBg: string; iconColor: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-sm text-slate-500">{label}</p>
      </div>
    </div>
  );
}
