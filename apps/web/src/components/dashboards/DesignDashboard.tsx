'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import {
  FolderKanban, FileText, CheckSquare, AlertTriangle,
  ArrowLeftRight, Upload, Palette, ShoppingCart, ChevronRight,
} from 'lucide-react';

interface Project {
  _id: string;
  title: string;
  progressPct: number;
  status: string;
  currentStage?: { _id: string; name: string } | string;
}
interface Approval { _id: string; kind: string; status: string; project?: { title: string }; }
interface Handover { _id: string; status: string; project?: { title: string }; fromDepartment?: { name: string }; toDepartment?: { name: string }; }
interface Blocker { _id: string; title: string; status: string; project?: { title: string }; }
interface TIDocument { _id: string; fileName: string; type: string; project?: { title: string }; }
interface PurchaseItem { _id: string; item: string; status: string; project?: { _id: string; title: string }; }
interface ShadeCardEntry { _id: string; area: string; codeName: string; material: string; photoUrl?: string; project?: string; }

function StatCard({ icon: Icon, label, value, color, href }: {
  icon: React.ElementType; label: string; value: number; color: string; href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4 hover:border-indigo-200 transition-colors">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        <p className="text-xs text-slate-500 font-medium mt-0.5">{label}</p>
      </div>
      {href && <ChevronRight className="w-4 h-4 text-slate-300" />}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

function stageName(stage?: { name: string } | string | null) {
  if (!stage) return null;
  return typeof stage === 'object' ? stage.name : stage;
}

const STAGE_COLORS: Record<string, string> = {
  Design: 'bg-indigo-100 text-indigo-700',
  Purchase: 'bg-amber-100 text-amber-700',
  Manufacturing: 'bg-orange-100 text-orange-700',
  Assembly: 'bg-teal-100 text-teal-700',
  Delivery: 'bg-sky-100 text-sky-700',
  Enquiry: 'bg-slate-100 text-slate-600',
  Measurement: 'bg-violet-100 text-violet-700',
};

export function DesignDashboard() {
  const user = useAuthStore((s) => s.user);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects', 'design-all'],
    queryFn: () => apiClient.get<Project[]>('/projects').then((r) => r.data),
  });

  const { data: approvals = [] } = useQuery<Approval[]>({
    queryKey: ['approvals', 'design'],
    queryFn: () => apiClient.get<Approval[]>('/approvals/mine').then((r) => r.data),
    refetchInterval: 30_000,
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
    queryKey: ['documents', 'design-drawings', projects.map((project) => project._id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map((project) =>
          apiClient
            .get<TIDocument[]>('/documents', { params: { projectId: project._id } })
            .then((r) =>
              r.data
                .filter((document) => document.type === 'drawing_2d' || document.type === 'drawing_3d')
                .map((document) => ({ ...document, project: { title: project.title } })),
            ),
        ),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
  });

  const { data: purchaseItems = [] } = useQuery<PurchaseItem[]>({
    queryKey: ['purchase-items', 'design', projects.map((project) => project._id).join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        projects.map((project) =>
          apiClient.get<PurchaseItem[]>(`/projects/${project._id}/purchase-items`).then((r) =>
            r.data.map((item) => ({
              ...item,
              project: { _id: project._id, title: project.title },
            })),
          ),
        ),
      );
      return results.flat();
    },
    enabled: projects.length > 0,
    refetchInterval: 30_000,
  });

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');
  const activeHandovers = handovers.filter((h) => h.status === 'draft' || h.status === 'confirmed');
  const pendingPurchase = purchaseItems.filter((i) => i.status === 'pending');
  const orderedPurchase = purchaseItems.filter((i) => i.status === 'ordered');

  // Shade card — fetch per active project (first 5 to avoid too many requests)
  const activeProjectIds = projects.slice(0, 5).map((p) => p._id);
  const { data: shadeCardCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['shade-card-counts', activeProjectIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        activeProjectIds.map(async (id) => {
          const r = await apiClient.get<ShadeCardEntry[]>(`/projects/${id}/shade-card`);
          counts[id] = r.data.length;
        }),
      );
      return counts;
    },
    enabled: activeProjectIds.length > 0,
  });
  const totalShadeEntries = Object.values(shadeCardCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Design Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">Welcome back, {user?.name}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/purchase-items"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <ShoppingCart className="w-3.5 h-3.5" /> Purchase Items
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FolderKanban} label="Assigned Projects" value={projects.length} color="bg-indigo-50 text-indigo-600" href="/dashboard/projects" />
        <StatCard icon={Palette} label="Shade Card Entries" value={totalShadeEntries} color="bg-violet-50 text-violet-600" />
        <StatCard icon={ShoppingCart} label="Purchase: Yet to Order" value={pendingPurchase.length} color="bg-amber-50 text-amber-600" href="/dashboard/purchase-items" />
        <StatCard icon={CheckSquare} label="Pending Approvals" value={pendingApprovals.length} color="bg-rose-50 text-rose-600" href="/dashboard/approvals" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Projects */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <FolderKanban className="w-4 h-4 text-indigo-500" /> My Projects
            </h2>
            <Link href="/dashboard/projects" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {projects.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No projects assigned yet.</p>
          ) : (
            <div className="space-y-2">
              {projects.slice(0, 7).map((p) => {
                const sName = stageName(p.currentStage);
                const stageColor = sName ? (STAGE_COLORS[sName] ?? 'bg-slate-100 text-slate-600') : '';
                const shadeCount = shadeCardCounts[p._id] ?? 0;
                return (
                  <Link key={p._id} href={`/dashboard/projects/${p._id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate group-hover:text-indigo-600">{p.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {sName && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${stageColor}`}>{sName}</span>
                        )}
                        {shadeCount > 0 && (
                          <span className="text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded font-medium">
                            {shadeCount} shade{shadeCount > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5">
                        <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${p.progressPct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400 w-8 text-right">{p.progressPct}%</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Purchase Items summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-amber-500" /> Purchase Items
            </h2>
            <Link href="/dashboard/purchase-items" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{pendingPurchase.length}</p>
              <p className="text-xs text-amber-600 mt-0.5">Yet to order</p>
            </div>
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-center">
              <p className="text-xl font-bold text-sky-700">{orderedPurchase.length}</p>
              <p className="text-xs text-sky-600 mt-0.5">Ordered</p>
            </div>
          </div>
          {pendingPurchase.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-3">Nothing waiting to be ordered.</p>
          ) : (
            <div className="space-y-1.5">
              {pendingPurchase.slice(0, 4).map((item) => (
                <div key={item._id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{item.item}</p>
                    {item.project && <p className="text-xs text-slate-400 truncate">{item.project.title}</p>}
                  </div>
                </div>
              ))}
              {pendingPurchase.length > 4 && (
                <Link href="/dashboard/purchase-items" className="block text-xs text-center text-indigo-600 hover:underline pt-1">
                  +{pendingPurchase.length - 4} more
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-rose-500" /> Pending Approvals
            </h2>
            <Link href="/dashboard/approvals" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-6">No pending approvals.</p>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.slice(0, 5).map((a) => (
                <div key={a._id} className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 border border-rose-100">
                  <div className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.project?.title ?? '—'}</p>
                    <p className="text-xs text-slate-500 capitalize">{a.kind.replace(/_/g, ' ')}</p>
                  </div>
                  <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full font-medium shrink-0">Pending</span>
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
                    <p className="text-xs text-slate-400 truncate">{d.project?.title ?? ''}</p>
                  </div>
                  <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium uppercase shrink-0">
                    {d.type.replace('drawing_', '')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Handovers */}
      {activeHandovers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-emerald-500" /> Active Handovers
            </h2>
            <Link href="/dashboard/handovers" className="text-xs text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {activeHandovers.slice(0, 4).map((h) => (
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
        </div>
      )}

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
