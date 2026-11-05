'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Building2,
  CheckCheck,
  CheckSquare,
  Clock3,
  FolderKanban,
  Layers3,
  RefreshCw,
  Users,
  UserCircle2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';

interface Project {
  _id: string;
  title: string;
  progressPct: number;
  targetDate?: string;
}
interface BoardData {
  [stage: string]: Project[];
}
interface ApprovalsSummary {
  count: number;
  list: Array<{
    _id: string;
    kind: string;
    project?: { title: string };
    requestedBy?: { name: string };
  }>;
}
interface BlockerSummary {
  _id: string;
  title: string;
  type: string;
  status: string;
  project?: { _id: string; title: string };
}
interface WorkloadItem {
  userId: string;
  userName: string;
  totalTasks: number;
  inProgress: number;
}
interface StageDuration {
  stageName: string;
  avgHours: number;
  count: number;
}
interface Dept {
  _id: string;
  name: string;
  order: number;
  defaultSlaHours: number;
}
interface Employee {
  _id: string;
  name: string;
  department?: { _id: string } | string;
  isActive: boolean;
}
interface Client {
  _id: string;
}
interface SlaReportRow {
  projectId: string;
  stageName: string;
  breached: boolean;
}

const DEPT_COLORS = [
  '#6366f1',
  '#0d9488',
  '#d97706',
  '#8b5cf6',
  '#0284c7',
  '#e11d48',
  '#059669',
  '#c2410c',
];
const panel =
  'rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_-4px_rgba(15,23,42,0.08)]';
const chartTick = { fontSize: 10, fill: '#64748b' };
const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 };

function useDashboardData<T>(key: string[], url: string) {
  return useQuery<T>({ queryKey: key, queryFn: () => apiClient.get<T>(url).then((r) => r.data) });
}

export default function DashboardOverviewPage() {
  const user = useAuthStore((s) => s.user);
  const [attentionTab, setAttentionTab] = useState<'approvals' | 'blockers'>('approvals');
  const [selectedDept, setSelectedDept] = useState<{
    dept: Dept;
    projects: Project[];
    staff: Employee[];
    breaches: number;
    color: string;
  } | null>(null);
  const board = useDashboardData<BoardData>(['dashboard-board'], '/dashboard/board');
  const approvals = useDashboardData<ApprovalsSummary>(
    ['dashboard-approvals'],
    '/dashboard/approvals-pending',
  );
  const blockers = useDashboardData<BlockerSummary[]>(
    ['dashboard-blockers'],
    '/dashboard/blockers',
  );
  const workload = useDashboardData<WorkloadItem[]>(['dashboard-workload'], '/dashboard/workload');
  const stageDurations = useDashboardData<StageDuration[]>(
    ['dashboard-stage-durations'],
    '/dashboard/stage-durations',
  );
  const departments = useDashboardData<Dept[]>(['departments'], '/departments');
  const employees = useDashboardData<Employee[]>(['users'], '/users');
  const clients = useDashboardData<Client[]>(['clients', ''], '/clients');
  const slaReport = useDashboardData<SlaReportRow[]>(['sla-report'], '/sla/report');
  const queries = [
    board,
    approvals,
    blockers,
    workload,
    stageDurations,
    departments,
    employees,
    clients,
    slaReport,
  ];
  const failed = queries.filter((q) => q.isError);
  const refreshing = queries.some((q) => q.isFetching);
  const sortedDepts = [...(departments.data ?? [])].sort((a, b) => a.order - b.order);
  const openBlockers = (blockers.data ?? []).filter(
    (b) => b.status === 'open' || b.status === 'sla_triggered',
  );
  const allProjects = Object.values(board.data ?? {}).flat();
  const activeEmployees = (employees.data ?? []).filter((e) => e.isActive);
  const breached = (slaReport.data ?? []).filter((s) => s.breached);
  const progress = allProjects.length
    ? Math.round(allProjects.reduce((sum, p) => sum + (p.progressPct ?? 0), 0) / allProjects.length)
    : 0;
  const attention = attentionTab === 'approvals' ? approvals : blockers;
  const attentionCount = attentionTab === 'approvals' ? approvals.data?.count : openBlockers.length;

  return (
    <div className="space-y-7 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-600">
            Your studio, at a glance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
            Workspace overview
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            A little clarity for everything you’re creating.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void Promise.all(queries.map((q) => q.refetch()))}
          disabled={refreshing}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing…' : 'Refresh overview'}
        </button>
      </div>

      {failed.length > 0 && (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            Some information couldn’t be loaded. Other available data is still shown.
          </span>
          <button
            type="button"
            onClick={() => void Promise.all(failed.map((q) => q.refetch()))}
            className="rounded px-2 py-1 font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </div>
      )}

      <section
        aria-labelledby="welcome-heading"
        className="relative isolate overflow-hidden rounded-2xl bg-[#20243f] text-white"
      >
        <div aria-hidden="true" className="studio-grid absolute inset-0 -z-10" />
        <div
          aria-hidden="true"
          className="absolute -right-16 -top-32 -z-10 h-96 w-96 rounded-full border-[48px] border-indigo-400/10"
        />
        <div className="grid gap-8 p-6 sm:p-8 xl:grid-cols-[1.5fr_1fr] xl:items-center">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
              From first idea to final handover
            </span>
            <h2
              id="welcome-heading"
              className="mt-4 text-2xl font-medium tracking-tight sm:text-3xl"
            >
              Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}.
            </h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
              Great spaces start with a clear plan. Keep your projects moving, your teams connected,
              and every detail in view.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard/projects"
                className="inline-flex min-h-11 items-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-indigo-50"
              >
                Explore projects
                <ArrowUpRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/handovers"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                View handovers
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/[0.06] p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-indigo-100">Portfolio progress</span>
              <Layers3 className="h-4 w-4 text-indigo-300" />
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-semibold tracking-tight">
                {board.isError || board.isPending ? '—' : `${progress}%`}
              </span>
              <span className="text-xs text-slate-300">average completion</span>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-indigo-300"
                style={{ width: `${Math.max(0, Math.min(progress, 100))}%` }}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-300">
              <span>
                {board.isError || board.isPending ? '—' : allProjects.length} active projects
              </span>
              <span>
                {employees.isError || employees.isPending ? '—' : activeEmployees.length} team
                members
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-5">
        <StatCard
          icon={FolderKanban}
          label="Active projects"
          value={allProjects.length}
          pending={board.isPending}
          error={board.isError}
          hint="Ideas taking shape"
          href="/dashboard/projects"
          tone="bg-indigo-50 text-indigo-600"
        />
        <StatCard
          icon={UserCircle2}
          label="Clients"
          value={clients.data?.length ?? 0}
          pending={clients.isPending}
          error={clients.isError}
          hint="Relationships you’re building"
          href="/dashboard/clients"
          tone="bg-teal-50 text-teal-700"
        />
        <StatCard
          icon={CheckSquare}
          label="Pending approvals"
          value={approvals.data?.count ?? 0}
          pending={approvals.isPending}
          error={approvals.isError}
          hint="Ready for your review"
          href="/dashboard/approvals"
          tone="bg-amber-50 text-amber-700"
        />
        <StatCard
          icon={AlertTriangle}
          label="Unresolved blockers"
          value={openBlockers.length}
          pending={blockers.isPending}
          error={blockers.isError}
          hint="Help projects move forward"
          href="/dashboard/blockers"
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="pipeline-heading" className={`${panel} min-w-0 overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
            <div>
              <h2 id="pipeline-heading" className="font-semibold text-slate-900">
                Project pipeline
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Every department. One connected journey.
              </p>
            </div>
            <Link
              href="/dashboard/projects"
              className="inline-flex items-center gap-2 py-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
            >
              All projects
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-5 sm:p-6">
            <DataState
              pending={departments.isPending || board.isPending}
              error={departments.isError || board.isError}
              empty={!sortedDepts.length}
              emptyText="Your project pipeline will appear when departments are set up."
            >
              <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                {sortedDepts.map((dept, index) => {
                  const projects = board.data?.[dept.name] ?? [];
                  const staff = activeEmployees.filter(
                    (e) =>
                      (typeof e.department === 'object' ? e.department?._id : e.department) ===
                      dept._id,
                  );
                  const breaches = breached.filter((s) => s.stageName === dept.name).length;
                  const color = DEPT_COLORS[index % DEPT_COLORS.length];
                  return (
                    <div
                      key={dept._id}
                      className="rounded-xl border border-slate-200/80 p-4 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                      onClick={() => setSelectedDept({ dept, projects, staff, breaches, color })}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                          style={{ color, backgroundColor: `${color}12` }}
                        >
                          {String(dept.order).padStart(2, '0')}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock3 className="h-3 w-3" />
                          {dept.defaultSlaHours}h SLA
                        </span>
                      </div>
                      <h3 className="mt-3 text-sm font-semibold text-slate-800">{dept.name}</h3>
                      <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                        <span>
                          {projects.length} project{projects.length === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {employees.isError || employees.isPending ? '—' : staff.length}
                        </span>
                      </div>
                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                        {projects.slice(0, 2).map((p) => (
                          <Link
                            key={p._id}
                            href={`/dashboard/projects/${p._id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="group block rounded-lg p-1.5 transition-colors hover:bg-slate-50"
                          >
                            <div className="flex gap-2 text-xs">
                              <span className="min-w-0 flex-1 truncate text-slate-600 group-hover:text-indigo-600">
                                {p.title}
                              </span>
                              <span className="text-slate-500">{p.progressPct ?? 0}%</span>
                            </div>
                            <div className="mt-2 h-1 rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(0, Math.min(p.progressPct ?? 0, 100))}%`,
                                  backgroundColor: color,
                                }}
                              />
                            </div>
                          </Link>
                        ))}
                        {!projects.length && (
                          <p className="py-3 text-xs text-slate-500">Ready for the next project</p>
                        )}
                        {projects.length > 2 && (
                          <Link
                            href="/dashboard/projects"
                            onClick={(e) => e.stopPropagation()}
                            className="block px-1.5 py-1 text-xs text-indigo-600"
                          >
                            +{projects.length - 2} more in the project list
                          </Link>
                        )}
                      </div>
                      {breaches > 0 && (
                        <Link
                          href="/dashboard/blockers"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          {breaches} SLA breach{breaches === 1 ? '' : 'es'}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
              {(board.data?.Unassigned?.length ?? 0) > 0 && (
                <Link
                  href="/dashboard/projects"
                  className="mt-4 block rounded-lg bg-amber-50 p-3 text-xs text-amber-800"
                >
                  {board.data?.Unassigned.length} project(s) still need a department. View projects
                  →
                </Link>
              )}
            </DataState>
          </div>
        </section>

        <div className="space-y-5">
          <section aria-labelledby="attention-heading" className={`${panel} overflow-hidden`}>
            <div className="p-5">
              <h2 id="attention-heading" className="font-semibold text-slate-900">
                Needs attention
              </h2>
              <p className="mt-1 text-xs text-slate-500">Small decisions. Forward momentum.</p>
            </div>
            <div
              className="mx-5 mb-2 flex gap-1 rounded-lg bg-slate-100 p-1"
              aria-label="Attention category"
            >
              {(['approvals', 'blockers'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={attentionTab === tab}
                  onClick={() => setAttentionTab(tab)}
                  className={`min-h-10 flex-1 rounded-md text-xs font-semibold capitalize transition-colors ${attentionTab === tab ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-5 pt-2">
              <DataState
                pending={attention.isPending}
                error={attention.isError}
                empty={!attentionCount}
                emptyText={
                  attentionTab === 'approvals'
                    ? 'All caught up. No approvals waiting.'
                    : 'No unresolved blockers. Keep creating.'
                }
              >
                <div className="divide-y divide-slate-100">
                  {attentionTab === 'approvals'
                    ? approvals.data?.list
                        .slice(0, 4)
                        .map((a) => (
                          <AttentionItem
                            key={a._id}
                            href="/dashboard/approvals"
                            icon={CheckSquare}
                            title={a.project?.title ?? 'Project approval'}
                            subtitle={a.kind.replace(/_/g, ' ')}
                            detail={a.requestedBy?.name ?? 'Awaiting review'}
                            tone="bg-amber-50 text-amber-700"
                          />
                        ))
                    : openBlockers
                        .slice(0, 4)
                        .map((b) => (
                          <AttentionItem
                            key={b._id}
                            href="/dashboard/blockers"
                            icon={AlertTriangle}
                            title={b.title}
                            subtitle={b.project?.title ?? 'Project blocker'}
                            detail={b.status === 'sla_triggered' ? 'SLA escalated' : 'Open blocker'}
                            tone="bg-rose-50 text-rose-600"
                          />
                        ))}
                </div>
              </DataState>
            </div>
            <Link
              href={`/dashboard/${attentionTab}`}
              className="flex min-h-12 items-center justify-center gap-2 border-t border-slate-100 bg-slate-50/50 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
            >
              View all {attentionTab}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
          <section className="rounded-2xl border border-indigo-100 bg-indigo-50/70 p-5">
            <div className="flex items-center gap-2 text-indigo-700">
              <Building2 className="h-4 w-4" />
              <h2 className="text-sm font-semibold">Keep your studio in sync</h2>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Review team assignments and make sure every project has the right people behind it.
            </p>
            <Link
              href="/dashboard/users"
              className="mt-4 inline-flex items-center gap-2 py-1 text-xs font-semibold text-indigo-700"
            >
              Meet your team
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>
        </div>
      </div>

      <section aria-labelledby="insights-heading">
        <h2
          id="insights-heading"
          className="mb-4 text-lg font-semibold tracking-tight text-slate-900"
        >
          Behind the progress
        </h2>
        <div className="grid gap-5 xl:grid-cols-2">

          {/* ── Chart 1: Project Status Distribution ── */}
          <div className={`${panel} min-w-0 p-5 sm:p-6`}>
            <h3 className="text-sm font-semibold text-slate-900">Project status</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              How projects are spread across pipeline stages.
            </p>
            <DataState
              pending={board.isPending || departments.isPending}
              error={board.isError || departments.isError}
              empty={!allProjects.length}
              emptyText="Project distribution will appear once projects are in the pipeline."
            >
              {(() => {
                const stageData = sortedDepts
                  .map((d, i) => ({
                    name: d.name,
                    value: board.data?.[d.name]?.length ?? 0,
                    color: DEPT_COLORS[i % DEPT_COLORS.length],
                  }))
                  .filter((d) => d.value > 0);
                return (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie
                          data={stageData}
                          cx="50%"
                          cy="50%"
                          innerRadius={45}
                          outerRadius={72}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {stageData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(v, _n, props) => [
                            `${v} project${Number(v) !== 1 ? 's' : ''}`,
                            props.payload.name,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5 overflow-hidden">
                      {stageData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2 text-xs">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                          <span className="flex-1 truncate text-slate-600">{d.name}</span>
                          <span className="font-semibold text-slate-800">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </DataState>
          </div>

          {/* ── Chart 2: SLA Performance ── */}
          <div className={`${panel} min-w-0 p-5 sm:p-6`}>
            <h3 className="text-sm font-semibold text-slate-900">SLA performance</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              On-time vs breached projects per stage.
            </p>
            <DataState
              pending={slaReport.isPending}
              error={slaReport.isError}
              empty={!slaReport.data?.length}
              emptyText="SLA data will appear after the first stage completes."
            >
              {(() => {
                const byStage: Record<string, { stage: string; onTime: number; breached: number }> = {};
                (slaReport.data ?? []).forEach((r) => {
                  if (!byStage[r.stageName]) byStage[r.stageName] = { stage: r.stageName, onTime: 0, breached: 0 };
                  if (r.breached) byStage[r.stageName].breached++;
                  else byStage[r.stageName].onTime++;
                });
                const data = Object.values(byStage);
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data} margin={{ top: 4, right: 0, left: -24, bottom: 4 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="stage" tick={chartTick} axisLine={false} tickLine={false} tickMargin={8} />
                      <YAxis tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="onTime" name="On time" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} maxBarSize={28} />
                      <Bar dataKey="breached" name="Breached" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} maxBarSize={28} />
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </DataState>
          </div>

          {/* ── Chart 3: Team Workload ── */}
          <div className={`${panel} min-w-0 p-5 sm:p-6`}>
            <h3 className="text-sm font-semibold text-slate-900">Team workload</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              Open tasks and work already in motion per person.
            </p>
            <DataState
              pending={workload.isPending}
              error={workload.isError}
              empty={!workload.data?.length}
              emptyText="Team workload will appear as tasks are assigned."
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  accessibilityLayer
                  data={workload.data}
                  margin={{ top: 4, right: 0, left: -24, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="userName" tick={chartTick} axisLine={false} tickLine={false} tickMargin={8} />
                  <YAxis tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Bar dataKey="totalTasks" name="Total tasks" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={20} />
                  <Bar dataKey="inProgress" name="In progress" fill="#a5b4fc" radius={[4, 4, 0, 0]} maxBarSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </DataState>
          </div>

          {/* ── Chart 4: Project Completion Trend ── */}
          <div className={`${panel} min-w-0 p-5 sm:p-6`}>
            <h3 className="text-sm font-semibold text-slate-900">Project completion trend</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              How many projects sit at each completion milestone.
            </p>
            <DataState
              pending={board.isPending}
              error={board.isError}
              empty={!allProjects.length}
              emptyText="Completion data will appear once projects are active."
            >
              {(() => {
                const buckets = [
                  { label: '0–25%', projects: allProjects.filter((p) => (p.progressPct ?? 0) <= 25).length },
                  { label: '26–50%', projects: allProjects.filter((p) => (p.progressPct ?? 0) > 25 && (p.progressPct ?? 0) <= 50).length },
                  { label: '51–75%', projects: allProjects.filter((p) => (p.progressPct ?? 0) > 50 && (p.progressPct ?? 0) <= 75).length },
                  { label: '76–99%', projects: allProjects.filter((p) => (p.progressPct ?? 0) > 75 && (p.progressPct ?? 0) < 100).length },
                  { label: '100%', projects: allProjects.filter((p) => (p.progressPct ?? 0) >= 100).length },
                ];
                return (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={buckets} margin={{ top: 4, right: 8, left: -24, bottom: 4 }}>
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.18} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" tick={chartTick} axisLine={false} tickLine={false} tickMargin={8} />
                      <YAxis tick={chartTick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(v) => [`${v} project${Number(v) !== 1 ? 's' : ''}`, 'Count']}
                      />
                      <Area
                        type="monotone"
                        dataKey="projects"
                        name="Projects"
                        stroke="#6366f1"
                        strokeWidth={2}
                        fill="url(#areaGrad)"
                        dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </DataState>
          </div>

        </div>
      </section>
      <p className="text-center text-[11px] text-slate-500">
        Trendy Interios · Thoughtful spaces. Connected teams.
      </p>

      {selectedDept && (
        <DepartmentDetailModal
          dept={selectedDept.dept}
          projects={selectedDept.projects}
          staff={selectedDept.staff}
          breaches={selectedDept.breaches}
          color={selectedDept.color}
          onClose={() => setSelectedDept(null)}
        />
      )}
    </div>
  );
}

function DepartmentDetailModal({
  dept,
  projects,
  staff,
  breaches,
  color,
  onClose,
}: {
  dept: Dept;
  projects: Project[];
  staff: Employee[];
  breaches: number;
  color: string;
  onClose: () => void;
}) {
  const avgProgress =
    projects.length
      ? Math.round(projects.reduce((s, p) => s + (p.progressPct ?? 0), 0) / projects.length)
      : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
              style={{ color, backgroundColor: `${color}18` }}
            >
              {String(dept.order).padStart(2, '0')}
            </span>
            <div>
              <h2 className="text-base font-semibold text-slate-900">{dept.name}</h2>
              <p className="text-xs text-slate-400">Department details</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">SLA</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{dept.defaultSlaHours}h</p>
              <p className="text-[10px] text-slate-400">per stage</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">Staff</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{staff.length}</p>
              <p className="text-[10px] text-slate-400">members</p>
            </div>
            <div className={`rounded-xl border p-3 text-center ${breaches > 0 ? 'border-rose-100 bg-rose-50' : 'border-slate-100 bg-slate-50'}`}>
              <p className={`text-[10px] font-medium uppercase tracking-wide ${breaches > 0 ? 'text-rose-400' : 'text-slate-400'}`}>SLA Breaches</p>
              <p className={`mt-1 text-xl font-bold ${breaches > 0 ? 'text-rose-600' : 'text-slate-800'}`}>{breaches}</p>
              <p className={`text-[10px] ${breaches > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {breaches > 0 ? 'needs attention' : 'all clear'}
              </p>
            </div>
          </div>

          {/* Staff members */}
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Staff members
            </h3>
            {staff.length === 0 ? (
              <p className="text-xs text-slate-400">No staff assigned to this department.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {staff.map((emp) => (
                  <span
                    key={emp._id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700"
                  >
                    <span
                      className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                      style={{ backgroundColor: color }}
                    >
                      {(typeof emp.name === 'string' ? emp.name : '?')[0].toUpperCase()}
                    </span>
                    {emp.name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Active projects */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active projects
              </h3>
              {projects.length > 0 && (
                <span className="text-xs text-slate-400">avg {avgProgress}% complete</span>
              )}
            </div>
            {projects.length === 0 ? (
              <p className="text-xs text-slate-400">No active projects in this department.</p>
            ) : (
              <div className="space-y-2">
                {projects.map((p) => (
                  <Link
                    key={p._id}
                    href={`/dashboard/projects/${p._id}`}
                    onClick={onClose}
                    className="group flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 hover:border-indigo-200 hover:bg-indigo-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-700 truncate group-hover:text-indigo-700">{p.title}</p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(0, Math.min(p.progressPct ?? 0, 100))}%`,
                              backgroundColor: color,
                            }}
                          />
                        </div>
                        <span className="text-[11px] font-medium text-slate-500 shrink-0">{p.progressPct ?? 0}%</span>
                      </div>
                      {p.targetDate && (
                        <p className="mt-1 text-[10px] text-slate-400">
                          Due {new Date(p.targetDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* SLA breach warning */}
          {breaches > 0 && (
            <Link
              href="/dashboard/blockers"
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 hover:bg-rose-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {breaches} SLA breach{breaches !== 1 ? 'es' : ''} — review blockers for this department
              </span>
              <ArrowRight className="w-4 h-4 ml-auto shrink-0" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  pending,
  error,
  hint,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  pending: boolean;
  error: boolean;
  hint: string;
  href: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className={`${panel} group p-4 transition-colors hover:border-indigo-300 sm:p-5`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-xl p-2.5 ${tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-600" />
      </div>
      <p className="mt-4 text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
      <div className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
        {pending ? (
          <span
            aria-label="Loading"
            className="inline-block h-8 w-12 animate-pulse rounded bg-slate-100"
          />
        ) : error ? (
          '—'
        ) : (
          value
        )}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">
        {error ? 'Currently unavailable' : hint}
      </p>
    </Link>
  );
}

function AttentionItem({
  href,
  icon: Icon,
  title,
  subtitle,
  detail,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  detail: string;
  tone: string;
}) {
  return (
    <Link href={href} className="group flex items-start gap-3 py-4">
      <span className={`rounded-lg p-2 ${tone}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm font-medium text-slate-800 group-hover:text-indigo-600">
          {title}
        </p>
        <p className="mt-1 text-xs capitalize text-slate-500">{subtitle}</p>
        <p className="mt-1 text-[11px] text-slate-500">{detail}</p>
      </div>
      <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
    </Link>
  );
}

function DataState({
  pending,
  error,
  empty,
  emptyText,
  children,
}: {
  pending: boolean;
  error: boolean;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
}) {
  if (pending)
    return (
      <div role="status" className="space-y-3 py-4">
        <span className="sr-only">Loading data</span>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
        ))}
      </div>
    );
  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-slate-500">
        <AlertTriangle className="h-6 w-6 text-amber-600" />
        <p>
          This information is unavailable.
          <br />
          Use “Refresh overview” to try again.
        </p>
      </div>
    );
  if (empty)
    return (
      <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
        <span className="rounded-full bg-slate-50 p-3 text-slate-400">
          <CheckCheck className="h-5 w-5" />
        </span>
        <p className="max-w-xs text-xs leading-5 text-slate-500">{emptyText}</p>
      </div>
    );
  return <>{children}</>;
}
