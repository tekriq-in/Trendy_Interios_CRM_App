'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { FolderKanban, FileText, CheckSquare, AlertTriangle, ArrowLeftRight, Clock, Upload } from 'lucide-react';

interface Project {
  _id: string; title: string; progressPct: number; status: string;
  currentStage?: { _id: string; name: string } | string;
}
interface Approval { _id: string; kind: string; status: string; project?: { title: string }; createdAt?: string; }
interface Handover { _id: string; status: string; project?: { title: string }; fromDepartment?: { name: string }; toDepartment?: { name: string }; }
interface Blocker { _id: string; title: string; status: string; project?: { title: string }; }
interface TIDocument { _id: string; fileName: string; type: string; createdAt?: string; project?: { title: string }; }

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

export function DesignDashboard() {
  const user = useAuthStore((s) => s.user);
  const deptId = user?.department?.id;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'design-dept'],
    queryFn: () => apiClient.get<Project[]>('/projects').then((r) => {
      // Filter to projects currently in Design stage
      return r.data.filter((p) => {
        const stage = p.currentStage;
        if (!stage) return false;
        const name = typeof stage === 'object' ? stage.name : '';
        return name === 'Design';
      });
    }),
  });

  const { data: approvals = [] } = useQuery<Approval[]>({
    queryKey: ['approvals', 'design'],
    queryFn: () => apiClient.get<Approval[]>('/approvals').then((r) => r.data),
  });

  const { data: handovers = [] } = useQuery<Handover[]>({
    queryKey: ['handovers', 'design'],
    queryFn: () => apiClient.get<Handover[]>('/handovers').then((r) => r.data),
  });

  const { data: blockers = [] } = useQuery<Blocker[]>({
    queryKey: ['blockers', 'design'],
    queryFn: () => apiClient.get<Blocker[]>('/blockers').then((r) => r.data.filter((b) => b.status === 'open')),
  });

  const { data: drawings = [] } = useQuery<TIDocument[]>({
    queryKey: ['documents', 'design-drawings'],
    queryFn: () => apiClient.get<TIDocument[]>('/documents', {
      params: { departmentId: deptId },
    }).then((r) => r.data.filter((d) => d.type === 'drawing_2d' || d.type === 'drawing_3d')),
    enabled: !!deptId,
  });

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const activeHandovers = handovers.filter((h) => h.status === 'draft' || h.status === 'confirmed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Design Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name}. Here&apos;s your design workspace.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Active Projects" value={projects.length} color="bg-indigo-50 text-indigo-600" />
        <StatCard icon={FileText} label="Drawings Uploaded" value={drawings.length} color="bg-violet-50 text-violet-600" />
        <StatCard icon={CheckSquare} label="Pending Approvals" value={pendingApprovals.length} color="bg-amber-50 text-amber-600" />
        <StatCard icon={AlertTriangle} label="Open Blockers" value={blockers.length} color="bg-red-50 text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Design Projects */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-500" /> Projects in Design
            </h2>
            <Link href="/dashboard/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No projects currently in Design stage.</p>
          ) : (
            <div className="space-y-3">
              {projects.slice(0, 6).map((p) => (
                <Link key={p._id} href={`/dashboard/projects/${p._id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{p.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.progressPct}% complete</p>
                  </div>
                  <div className="w-20 bg-slate-100 rounded-full h-1.5 shrink-0">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${p.progressPct}%` }} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-amber-500" /> Pending Approvals
            </h2>
            <Link href="/dashboard/approvals" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No pending approvals.</p>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.slice(0, 5).map((a) => (
                <div key={a._id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.project?.title ?? '—'}</p>
                    <p className="text-xs text-slate-500 capitalize">{a.kind.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Pending</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Drawings */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <Upload className="w-4 h-4 text-violet-500" /> Recent Drawings
            </h2>
          </div>
          {drawings.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No drawings uploaded yet.</p>
          ) : (
            <div className="space-y-2">
              {drawings.slice(0, 5).map((d) => (
                <div key={d._id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.fileName}</p>
                    <p className="text-xs text-slate-400">{d.project?.title ?? ''}</p>
                  </div>
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium uppercase shrink-0">
                    {d.type.replace('drawing_', '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Handovers */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-500" /> Active Handovers
            </h2>
            <Link href="/dashboard/handovers" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {activeHandovers.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No active handovers.</p>
          ) : (
            <div className="space-y-2">
              {activeHandovers.slice(0, 5).map((h) => (
                <div key={h._id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{h.project?.title ?? '—'}</p>
                    <p className="text-xs text-slate-400">{h.fromDepartment?.name} → {h.toDepartment?.name}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${h.status === 'confirmed' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                    {h.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Open Blockers */}
      {blockers.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 p-5">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Open Blockers
          </h2>
          <div className="space-y-2">
            {blockers.slice(0, 4).map((b) => (
              <div key={b._id} className="flex items-center gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
                <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.title}</p>
                  <p className="text-xs text-slate-500 truncate">{b.project?.title ?? ''}</p>
                </div>
                <Link href="/dashboard/blockers" className="text-xs text-red-600 hover:underline shrink-0">View</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
