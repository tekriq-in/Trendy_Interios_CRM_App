'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { PERMISSIONS } from '@ti/shared';
import { usePermissions } from '@/lib/usePermissions';
import { useAuthStore } from '@/store/auth.store';
import { ProjectChat } from '@/components/chat/ProjectChat';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft, ChevronRight, CheckCircle2, Loader2, UserPlus, X, Upload, FileText, Trash2, Plus, ClipboardList, ShoppingCart, AlertCircle, Pencil, Eye, Palette, Send } from 'lucide-react';
import { FileUpload, UploadedFile } from '@/components/ui/FileUpload';
import { FileViewerModal } from '@/components/ui/FileViewerModal';
import { ShadeCardSection } from '@/components/projects/ShadeCardSection';

interface Dept { _id: string; name: string; order: number; }
interface TeamMember { _id: string; name: string; email: string; }
interface StageHistory { stage: string | Dept; enteredAt: string; completedAt?: string; }
interface Project {
  _id: string; title: string; status: string; progressPct: number;
  currentStage?: Dept | string;
  stageHistory?: StageHistory[];
  assignedTeam?: TeamMember[];
  client?: { name: string; phone?: string; };
  targetDate?: string;
}
interface Task {
  _id: string; title: string; status: string;
  assignedTo?: { _id: string; name: string } | string;
  dueDate?: string;
}
interface TaskForm {
  title: string; departmentId: string; assignedToId: string; dueDate: string;
}
const EMPTY_TASK: TaskForm = { title: '', departmentId: '', assignedToId: '', dueDate: '' };
interface TIDocument { _id: string; fileName: string; mimeType: string; driveLink: string; type: string; }
interface PurchaseItem {
  _id: string; item: string; description?: string; quantity: number; unit?: string; supplier?: string;
  status: 'pending' | 'ordered' | 'received';
}
const EMPTY_PI = { item: '', description: '', quantity: 1, unit: '', supplier: '' };
const PURCHASE_ITEM_UNITS = ['pieces', 'square feet', 'meters', 'kilograms', 'liters', 'sets', 'boxes', 'sheets'];
interface AdditionalWork { description: string; amount: number; drawingRequired?: boolean; notifiedClient?: boolean; }
const EMPTY_AW = { description: '', amount: 0, drawingRequired: false };

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-700',
  waiting_for_client_approval: 'bg-orange-50 text-orange-700',
};

const TASK_DOT: Record<string, string> = {
  done: 'bg-emerald-500', in_progress: 'bg-blue-500', blocked: 'bg-red-500', pending: 'bg-slate-300',
};

interface Props { params: { id: string }; }

export default function ProjectDetailPage({ params }: Props) {
  const { id } = params;
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const authUser = useAuthStore((s) => s.user);
  const canEditProject = hasPermission(PERMISSIONS.PROJECTS_EDIT);
  const canAdvanceProject = hasPermission(PERMISSIONS.PROJECTS_ADVANCE_STAGE);
  const canCreateTask = hasPermission(PERMISSIONS.TASKS_CREATE);
  const canEditTask = hasPermission(PERMISSIONS.TASKS_EDIT);
  const canUploadDocuments = hasPermission(PERMISSIONS.DOCUMENTS_UPLOAD);
  const canDeleteDocuments = hasPermission(PERMISSIONS.DOCUMENTS_DELETE);
  const canManagePurchaseItems = hasPermission(PERMISSIONS.PURCHASE_ITEMS_MANAGE);
  const [advancing, setAdvancing] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [drawingType, setDrawingType] = useState<'drawing_2d' | 'drawing_3d'>('drawing_2d');
  const [viewingDoc, setViewingDoc] = useState<TIDocument | null>(null);
  const [drawingUploading, setDrawingUploading] = useState(false);
  const [drawingErr, setDrawingErr] = useState('');
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(EMPTY_TASK);
  const [taskPhotos, setTaskPhotos] = useState<UploadedFile[]>([]);
  const [taskErr, setTaskErr] = useState('');

  // Purchase Items
  const [showPIModal, setShowPIModal] = useState(false);
  const [editingPI, setEditingPI] = useState<PurchaseItem | null>(null);
  const [piForm, setPiForm] = useState(EMPTY_PI);
  const [piErr, setPiErr] = useState('');

  // Additional Work
  const [showAWModal, setShowAWModal] = useState(false);
  const [awForm, setAwForm] = useState(EMPTY_AW);
  const [awErr, setAwErr] = useState('');

  // Stage advance gate
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  const { data: project, isLoading } = useQuery<Project>({
    queryKey: ['project', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then((r) => r.data),
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['tasks', id],
    queryFn: () => apiClient.get(`/projects/${id}/tasks`).then((r) => r.data),
  });

  const { data: departments = [] } = useQuery<Dept[]>({
    queryKey: ['departments'],
    queryFn: () => apiClient.get('/departments').then((r) => r.data),
  });

  const { data: drawings = [] } = useQuery<TIDocument[]>({
    queryKey: ['drawings', id],
    queryFn: () =>
      apiClient.get('/documents', { params: { projectId: id } }).then((r) =>
        (r.data as TIDocument[]).filter((d) => d.type === 'drawing_2d' || d.type === 'drawing_3d'),
      ),
  });

  const { data: allUsers = [] } = useQuery<TeamMember[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.get('/users').then((r) => r.data),
  });

  const { data: purchaseItems = [] } = useQuery<PurchaseItem[]>({
    queryKey: ['purchase-items', id],
    queryFn: () => apiClient.get(`/projects/${id}/purchase-items`).then((r) => r.data),
  });

  const { data: projectFull } = useQuery<{ additionalWork?: AdditionalWork[] }>({
    queryKey: ['project-full', id],
    queryFn: () => apiClient.get(`/projects/${id}`).then((r) => r.data),
  });

  interface ShadeEntry { _id: string; area: string; codeName: string; material: string; photoUrl?: string; units: string[]; }
  const { data: shadeCardEntries = [] } = useQuery<ShadeEntry[]>({
    queryKey: ['shade-card', id],
    queryFn: () => apiClient.get(`/projects/${id}/shade-card`).then((r) => r.data),
  });

  interface Approval { _id: string; kind: string; status: string; }
  const { data: projectApprovals = [] } = useQuery<Approval[]>({
    queryKey: ['approvals', 'project', id],
    queryFn: () => apiClient.get('/approvals', { params: { projectId: id } }).then((r) => r.data),
  });

  const advanceMut = useMutation({
    mutationFn: (nextStageId: string) =>
      apiClient.post(`/projects/${id}/advance-stage`, { nextStageId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      setAdvancing(false);
      setShowAdvanceModal(false);
      toast('success', 'Stage advanced successfully.');
    },
    onError: (error: unknown) => {
      setAdvancing(false);
      const responseMessage = (error as { response?: { data?: { message?: string | string[] } } })
        ?.response?.data?.message;
      const message = Array.isArray(responseMessage) ? responseMessage.join(' ') : responseMessage;
      toast('error', message || 'Failed to advance stage.');
    },
  });

  const sendShadeCardApprovalMut = useMutation({
    mutationFn: () =>
      apiClient.post(`/projects/${id}/shade-card/send-approval`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      qc.invalidateQueries({ queryKey: ['approvals', 'project', id] });
      toast('success', 'Material Approval Sheet sent to customer as PDF via WhatsApp.');
    },
    onError: () => toast('error', 'Failed to send shade card to customer.'),
  });

  const closeProjectMut = useMutation({
    mutationFn: () => apiClient.patch(`/projects/${id}`, { status: 'completed' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast('success', 'Project marked as completed.');
    },
    onError: () => toast('error', 'Failed to close project.'),
  });

  const updateTeamMut = useMutation({
    mutationFn: (teamIds: string[]) =>
      apiClient.patch(`/projects/${id}`, { assignedTeamIds: teamIds }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      toast('success', 'Team updated.');
    },
    onError: () => toast('error', 'Failed to update team.'),
  });

  const createTaskMut = useMutation({
    mutationFn: (form: TaskForm) =>
      apiClient.post(`/projects/${id}/tasks`, {
        title: form.title,
        departmentId: form.departmentId,
        assignedToId: form.assignedToId,
        dueDate: form.dueDate || undefined,
      }),
    onSuccess: async (res) => {
      // Attach photos if any
      for (const photo of taskPhotos) {
        await apiClient.patch(`/tasks/${res.data._id}`, { photoId: photo._id });
      }
      qc.invalidateQueries({ queryKey: ['tasks', id] });
      toast('success', 'Task created.');
      setShowTaskModal(false);
      setTaskForm(EMPTY_TASK);
      setTaskPhotos([]);
      setTaskErr('');
    },
    onError: (e: unknown) => {
      setTaskErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create task.');
    },
  });

  const toggleTaskMut = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      apiClient.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', id] }),
    onError: () => toast('error', 'Failed to update task.'),
  });

  const deleteDrawingMut = useMutation({
    mutationFn: (docId: string) => apiClient.delete(`/documents/${docId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['drawings', id] });
      toast('success', 'Drawing removed.');
    },
    onError: () => toast('error', 'Failed to delete drawing.'),
  });

  const createPIMut = useMutation({
    mutationFn: (form: typeof EMPTY_PI) =>
      apiClient.post(`/projects/${id}/purchase-items`, {
        item: form.item.trim(),
        description: form.description || undefined,
        quantity: Number(form.quantity),
        unit: form.unit || undefined,
        supplier: form.supplier || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-items', id] });
      toast('success', 'Purchase item added.');
      setShowPIModal(false);
      setPiForm(EMPTY_PI);
      setPiErr('');
    },
    onError: () => setPiErr('Failed to add item.'),
  });

  const updatePIStatusMut = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      apiClient.patch(`/purchase-items/${itemId}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-items', id] }),
    onError: () => toast('error', 'Failed to update status.'),
  });

  const updatePIMut = useMutation({
    mutationFn: ({ itemId, form }: { itemId: string; form: typeof EMPTY_PI }) =>
      apiClient.patch(`/purchase-items/${itemId}`, {
        item: form.item.trim(),
        description: form.description.trim(),
        quantity: Number(form.quantity),
        unit: form.unit,
        supplier: form.supplier.trim(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-items', id] });
      toast('success', 'Purchase item updated.');
      setShowPIModal(false);
      setEditingPI(null);
      setPiForm(EMPTY_PI);
      setPiErr('');
    },
    onError: () => setPiErr('Failed to update item.'),
  });

  const addAWMut = useMutation({
    mutationFn: (form: typeof EMPTY_AW) =>
      apiClient.post(`/projects/${id}/additional-work`, {
        description: form.description.trim(),
        amount: Number(form.amount),
        drawingRequired: form.drawingRequired,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-full', id] });
      toast('success', 'Additional work logged.');
      setShowAWModal(false);
      setAwForm(EMPTY_AW);
      setAwErr('');
    },
    onError: () => setAwErr('Failed to log additional work.'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!project) return <p className="text-sm text-red-500">Project not found.</p>;

  const currentStageId = typeof project.currentStage === 'object' ? project.currentStage?._id : project.currentStage;
  const completedStageIds = new Set((project.stageHistory ?? []).filter((h) => h.completedAt).map((h) => typeof h.stage === 'object' ? h.stage._id : h.stage));

  const sortedDepts = [...departments].sort((a, b) => a.order - b.order);
  const currentIdx = sortedDepts.findIndex((d) => d._id === currentStageId);

  // When current stage is deactivated it won't appear in sortedDepts (active only).
  // Fall back to the first active dept whose order is greater than the current stage's order.
  const currentStageOrder = typeof project.currentStage === 'object' ? project.currentStage?.order ?? -1 : -1;
  const depsLoaded = departments.length > 0;
  const isAtFinalStage = depsLoaded && currentIdx === sortedDepts.length - 1;
  const nextStage: Dept | null = !depsLoaded
    ? null
    : currentIdx >= 0 && currentIdx < sortedDepts.length - 1
      ? sortedDepts[currentIdx + 1]
      : currentIdx === -1 && currentStageOrder >= 0
        ? sortedDepts.find((d) => d.order > currentStageOrder) ?? null
        : null;

  const teamIds = new Set((project.assignedTeam ?? []).map((m) => m._id));
  const isTeamMember = authUser?.id ? teamIds.has(authUser.id) : false;
  const canAdvance = canAdvanceProject || isTeamMember;

  // Shade card approval gate for Design → Purchase
  const currentStageName = typeof project.currentStage === 'object' ? project.currentStage?.name : '';
  const isDesignStage = currentStageName === 'Design';
  const shadeCardApproval = projectApprovals.find((a) => a.kind === 'client_update' && (a.status === 'pending' || a.status === 'approved'));
  const shadeCardApproved = shadeCardApproval?.status === 'approved';
  const shadeCardPending = shadeCardApproval?.status === 'pending';
  // Design→Purchase requires shade card entries AND customer approval
  const needsShadeCardGate = isDesignStage && nextStage?.name === 'Purchase';
  const canAdvanceDesign = !needsShadeCardGate || shadeCardApproved;

  function buildShadeCardMessage() {
    const clientName = project?.client?.name ?? 'Customer';
    const lines = [`Dear ${clientName},`,'',`Please find the material selection for your project "${project?.title ?? ''}":`, ''];
    const grouped: Record<string, ShadeEntry[]> = {};
    shadeCardEntries.forEach((e) => { (grouped[e.area] = grouped[e.area] ?? []).push(e); });
    Object.entries(grouped).forEach(([area, entries]) => {
      lines.push(`*${area}*`);
      entries.forEach((e) => {
        lines.push(`• ${e.units.join(', ')} — ${e.material}: ${e.codeName}`);
      });
      lines.push('');
    });
    lines.push('Kindly review and approve the above material selection.','','— Team Trendy Interios');
    return lines.join('\n');
  }

  async function handleDrawingUpload(file: File) {
    setDrawingUploading(true); setDrawingErr('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('projectId', id);
      fd.append('type', drawingType);
      await apiClient.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await qc.invalidateQueries({ queryKey: ['drawings', id] });
      toast('success', 'Drawing uploaded.');
    } catch {
      setDrawingErr('Upload failed. Please try again.');
      toast('error', 'Drawing upload failed.');
    } finally { setDrawingUploading(false); }
  }

  function toggleTeamMember(userId: string) {
    const next = new Set(teamIds);
    if (next.has(userId)) next.delete(userId);
    else next.add(userId);
    updateTeamMut.mutate([...next]);
  }

  return (
    <div className="space-y-6">
      {/* Back + Title */}
      <div className="flex items-start gap-4">
        <button onClick={() => router.back()} className="mt-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900 truncate">{project.title}</h1>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[project.status ?? 'active'] ?? 'bg-slate-100 text-slate-600'}`}>
              {(project.status ?? 'active').replace(/_/g, ' ')}
            </span>
          </div>
          {project.client && (
            <p className="text-sm text-slate-500 mt-0.5">
              <button
                onClick={() => router.push('/dashboard/clients')}
                className="text-indigo-600 hover:underline font-medium"
              >
                {project.client.name}
              </button>
              {project.client.phone ? ` · ${project.client.phone}` : ''}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-indigo-600">{project.progressPct ?? 0}%</div>
          <div className="text-xs text-slate-400">complete</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${project.progressPct ?? 0}%` }} />
      </div>

      {/* Stage pipeline */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Stage Pipeline</h2>
          {canAdvance && nextStage && project.status === 'active' && (
            needsShadeCardGate ? (
              /* Design → Purchase: gated by shade card customer approval */
              <button
                onClick={() => setShowAdvanceModal(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <Palette className="w-3.5 h-3.5" />
                Complete Design
              </button>
            ) : (
              /* All other stages: direct advance */
              <button
                onClick={() => { setAdvancing(true); advanceMut.mutate(nextStage._id); }}
                disabled={advancing || advanceMut.isPending}
                className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {advancing || advanceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
                Advance to {nextStage.name}
              </button>
            )
          )}
          {canEditProject && isAtFinalStage && project.status === 'active' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">Final stage</span>
              <button
                onClick={() => closeProjectMut.mutate()}
                disabled={closeProjectMut.isPending}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {closeProjectMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                Close Project
              </button>
            </div>
          )}
        </div>

        {/* Stepper */}
        <div className="overflow-x-auto pb-2">
          <div className="flex items-start min-w-max gap-0">
            {sortedDepts.map((dept, idx) => {
              const isCurrent = dept._id === currentStageId;
              const isDone = completedStageIds.has(dept._id);
              const stageEntry = (project.stageHistory ?? []).find((h) =>
                (typeof h.stage === 'object' ? h.stage._id : h.stage) === dept._id,
              );
              return (
                <div key={dept._id} className="flex items-start">
                  <div className="flex flex-col items-center gap-2 w-[90px]">
                    {/* Circle */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
                      isDone ? 'bg-emerald-500 text-white' :
                      isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                      'bg-slate-100 text-slate-400 border border-slate-200'
                    }`}>
                      {isDone ? <CheckCircle2 className="w-5 h-5" /> : <span>{idx + 1}</span>}
                    </div>
                    {/* Label */}
                    <div className="text-center">
                      <span className={`text-xs leading-tight font-semibold ${
                        isCurrent ? 'text-indigo-700' : isDone ? 'text-emerald-700' : 'text-slate-400'
                      }`}>
                        {dept.name}
                      </span>
                      {isCurrent && stageEntry && (
                        <p className="text-[10px] text-indigo-400 mt-0.5 leading-tight">
                          Since {new Date(stageEntry.enteredAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {isDone && stageEntry?.completedAt && (
                        <p className="text-[10px] text-emerald-500 mt-0.5 leading-tight">
                          Done {new Date(stageEntry.completedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Connector line */}
                  {idx < sortedDepts.length - 1 && (
                    <div className={`h-0.5 w-8 mt-5 shrink-0 ${isDone ? 'bg-emerald-400' : isCurrent ? 'bg-indigo-200' : 'bg-slate-200'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Team + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned Team */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Assigned Team</h2>
            {canEditProject && <button onClick={() => setShowTeamModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Manage
            </button>}
          </div>
          {(project.assignedTeam ?? []).length === 0 ? (
            <p className="text-sm text-slate-400">No team members assigned.</p>
          ) : (
            <div className="space-y-2">
              {(project.assignedTeam ?? []).map((m) => (
                <div key={m._id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                    {m.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{m.name}</div>
                    <div className="text-xs text-slate-400 truncate">{m.email}</div>
                  </div>
                  {canEditProject && <button onClick={() => toggleTeamMember(m._id)} className="ml-auto p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Tasks</h2>
            {canCreateTask && <button
              onClick={() => { setShowTaskModal(true); setTaskForm(EMPTY_TASK); setTaskPhotos([]); setTaskErr(''); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>}
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : null;
                return (
                  <div key={task._id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                    {canEditTask ? <button
                      onClick={() => nextStatus && toggleTaskMut.mutate({ taskId: task._id, status: nextStatus })}
                      className={`w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center transition-colors ${
                        task.status === 'done' ? 'bg-emerald-500 border-emerald-500' :
                        task.status === 'in_progress' ? 'border-blue-500' :
                        task.status === 'blocked' ? 'bg-red-500 border-red-500' :
                        'border-slate-300 hover:border-indigo-400'
                      }`}
                      title={nextStatus ? `Mark as ${nextStatus.replace('_', ' ')}` : undefined}
                    >
                      {task.status === 'done' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </button> : <span className={`w-4 h-4 rounded-full shrink-0 border-2 flex items-center justify-center ${task.status === 'done' ? 'bg-emerald-500 border-emerald-500' : task.status === 'blocked' ? 'bg-red-500 border-red-500' : task.status === 'in_progress' ? 'border-blue-500' : 'border-slate-300'}`} aria-label={task.status}>
                      {task.status === 'done' && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </span>}
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm block truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</span>
                      {task.assignedTo && (
                        <span className="text-xs text-slate-400 truncate">
                          {typeof task.assignedTo === 'object' ? task.assignedTo.name : ''}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 capitalize shrink-0">{task.status.replace('_', ' ')}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Drawings */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Drawings</h2>
          <div className="flex items-center gap-2">
            {canUploadDocuments && <>
              <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-semibold">
              {(['drawing_2d', 'drawing_3d'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDrawingType(t)}
                  className={`px-3 py-1.5 transition-colors ${drawingType === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  {t === 'drawing_2d' ? '2D' : '3D'}
                </button>
              ))}
              </div>
              <input
              ref={drawingInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf,.svg"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleDrawingUpload(f); }}
              />
              <button
              onClick={() => drawingInputRef.current?.click()}
              disabled={drawingUploading}
              className="flex items-center gap-1.5 text-xs font-semibold bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {drawingUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Upload {drawingType === 'drawing_2d' ? '2D' : '3D'} Drawing
              </button>
            </>}
          </div>
        </div>

        {drawingErr && <p className="text-xs text-red-500">{drawingErr}</p>}

        {drawings.length === 0 ? (
          <p className="text-sm text-slate-400">No drawings uploaded yet.</p>
        ) : (
          <div className="space-y-2">
            {drawings.map((d) => (
              <div key={d._id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-800 flex-1 truncate">{d.fileName}</span>
                <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded font-medium uppercase shrink-0">{d.type.replace('drawing_', '')}</span>
                {d.driveLink && (
                  <button
                    onClick={() => setViewingDoc(d)}
                    className="p-1 text-slate-400 hover:text-indigo-600 shrink-0 transition-colors"
                    title="View file"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDeleteDocuments && <button
                  onClick={() => deleteDrawingMut.mutate(d._id)}
                  disabled={deleteDrawingMut.isPending}
                  className="p-1 text-slate-300 hover:text-red-500 shrink-0 transition-colors disabled:opacity-50"
                  title="Delete drawing"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Purchase Items */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-slate-400" /> Purchase Items
          </h2>
          {canManagePurchaseItems && <button
            onClick={() => { setEditingPI(null); setShowPIModal(true); setPiForm(EMPTY_PI); setPiErr(''); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Item
          </button>}
        </div>
        {purchaseItems.length === 0 ? (
          <p className="text-sm text-slate-400">No purchase items yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-400 uppercase">
                  <th className="text-left py-2 pr-3 font-semibold">Item</th>
                  <th className="text-left py-2 pr-3 font-semibold">Qty</th>
                  <th className="text-left py-2 pr-3 font-semibold">Supplier</th>
                  <th className="text-left py-2 font-semibold">Status</th>
                  <th className="text-right py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseItems.map((pi) => (
                  <tr key={pi._id}>
                    <td className="py-2.5 pr-3">
                      <p className="font-medium text-slate-800">{pi.item}</p>
                      {pi.description && <p className="text-xs text-slate-400">{pi.description}</p>}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{pi.quantity}{pi.unit ? ` ${pi.unit}` : ''}</td>
                    <td className="py-2.5 pr-3 text-slate-500">{pi.supplier ?? '—'}</td>
                    <td className="py-2.5">
                      {canManagePurchaseItems ? <select
                        value={pi.status}
                        onChange={(e) => updatePIStatusMut.mutate({ itemId: pi._id, status: e.target.value })}
                        className={`text-xs font-semibold rounded-full px-2.5 py-1 border-0 focus:ring-2 focus:ring-indigo-500 cursor-pointer ${
                          pi.status === 'received' ? 'bg-emerald-50 text-emerald-700' :
                          pi.status === 'ordered' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <option value="pending">Pending</option>
                        <option value="ordered">Ordered</option>
                        <option value="received">Received</option>
                      </select> : <span className="text-xs font-semibold capitalize">{pi.status}</span>}
                    </td>
                    <td className="py-2.5 text-right">
                      {canManagePurchaseItems && <button
                        type="button"
                        aria-label={`Edit ${pi.item}`}
                        title="Edit purchase item"
                        onClick={() => {
                          setEditingPI(pi);
                          setPiForm({ item: pi.item, description: pi.description ?? '', quantity: pi.quantity, unit: pi.unit ?? '', supplier: pi.supplier ?? '' });
                          setPiErr('');
                          setShowPIModal(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Shade Card */}
      <ShadeCardSection
        projectId={id}
        projectTitle={project?.title ?? ''}
        clientName={project?.client?.name}
      />

      {/* Additional Work */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-slate-400" /> Additional Work
          </h2>
          {canEditProject && <button
            onClick={() => { setShowAWModal(true); setAwForm(EMPTY_AW); setAwErr(''); }}
            className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Log Work
              </button>}
        </div>
        {(projectFull?.additionalWork ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">No additional work logged.</p>
        ) : (
          <div className="space-y-2">
            {(projectFull?.additionalWork ?? []).map((aw, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{aw.description}</p>
                  {aw.drawingRequired && <span className="text-xs text-amber-600 font-semibold">Drawing required</span>}
                </div>
                <span className="text-sm font-bold text-slate-700 shrink-0">₹{aw.amount.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Team Chat</h2>
        <ProjectChat projectId={id} />
      </div>

      {/* Create Task Modal */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-indigo-600" />
                <h2 className="text-lg font-semibold text-slate-900">Add Task</h2>
              </div>
              <button onClick={() => setShowTaskModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Title *</label>
                <input
                  type="text"
                  value={taskForm.title}
                  onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Install wall tiles in bedroom"
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Department *</label>
                  <select
                    value={taskForm.departmentId}
                    onChange={e => setTaskForm(p => ({ ...p, departmentId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select…</option>
                    {sortedDepts.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Assign to *</label>
                  <select
                    value={taskForm.assignedToId}
                    onChange={e => setTaskForm(p => ({ ...p, assignedToId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select…</option>
                    {allUsers.filter((u) => (u as unknown as { isActive: boolean }).isActive !== false).map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Due date</label>
                <input
                  type="date"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(p => ({ ...p, dueDate: e.target.value }))}
                  className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <FileUpload
                projectId={id}
                type="photo"
                accept="image/*"
                multiple
                label="Photos"
                onUploaded={setTaskPhotos}
              />
              {taskErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{taskErr}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              {canCreateTask && <button
                onClick={() => createTaskMut.mutate(taskForm)}
                disabled={!taskForm.title.trim() || !taskForm.departmentId || !taskForm.assignedToId || createTaskMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createTaskMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {createTaskMut.isPending ? 'Creating…' : 'Create Task'}
          </button>}
            </div>
          </div>
        </div>
      )}

      {/* Purchase Item Modal */}
      {showPIModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">{editingPI ? 'Edit Purchase Item' : 'Add Purchase Item'}</h2>
              <button onClick={() => setShowPIModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Item name *</label>
                <input type="text" value={piForm.item} onChange={(e) => setPiForm((p) => ({ ...p, item: e.target.value }))}
                  placeholder="e.g. Laminate sheets" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description</label>
                <input type="text" value={piForm.description} onChange={(e) => setPiForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Optional details" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Quantity *</label>
                  <input type="number" min={1} value={piForm.quantity} onChange={(e) => setPiForm((p) => ({ ...p, quantity: Number(e.target.value) }))}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Unit</label>
                  <select value={piForm.unit} onChange={(e) => setPiForm((p) => ({ ...p, unit: e.target.value }))}
                    className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select unit</option>
                    {piForm.unit && !PURCHASE_ITEM_UNITS.includes(piForm.unit) && <option value={piForm.unit}>{piForm.unit}</option>}
                    {PURCHASE_ITEM_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Supplier</label>
                <input type="text" value={piForm.supplier} onChange={(e) => setPiForm((p) => ({ ...p, supplier: e.target.value }))}
                  placeholder="Vendor name" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              {piErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{piErr}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowPIModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button
                onClick={() => editingPI ? updatePIMut.mutate({ itemId: editingPI._id, form: piForm }) : createPIMut.mutate(piForm)}
                disabled={!piForm.item.trim() || Number(piForm.quantity) <= 0 || createPIMut.isPending || updatePIMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {(createPIMut.isPending || updatePIMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : editingPI ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {editingPI ? 'Save Changes' : 'Add Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Additional Work Modal */}
      {showAWModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Log Additional Work</h2>
              <button onClick={() => setShowAWModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Description *</label>
                <input type="text" value={awForm.description} onChange={(e) => setAwForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. Extra wardrobe in master bedroom" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount (₹) *</label>
                <input type="number" min={0} value={awForm.amount} onChange={(e) => setAwForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                  placeholder="0" className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={awForm.drawingRequired} onChange={(e) => setAwForm((p) => ({ ...p, drawingRequired: e.target.checked }))}
                  className="w-4 h-4 accent-indigo-600" />
                <span className="text-sm text-slate-700">Drawing required for this work</span>
              </label>
              {awErr && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{awErr}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowAWModal(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">Cancel</button>
              <button
                onClick={() => addAWMut.mutate(awForm)}
                disabled={!awForm.description.trim() || addAWMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {addAWMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Log Work
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Members Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-20 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Manage Team</h2>
              <button onClick={() => setShowTeamModal(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-1.5">
              {allUsers.filter((u) => (u as unknown as { isActive: boolean }).isActive).map((u) => {
                const isIn = teamIds.has(u._id);
                return (
                  <label key={u._id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${isIn ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <input type="checkbox" checked={isIn} onChange={() => toggleTeamMember(u._id)} className="w-4 h-4 accent-indigo-600" />
                    <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold shrink-0">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-800">{u.name}</div>
                      <div className="text-xs text-slate-400">{u.email}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
              <button onClick={() => setShowTeamModal(false)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Done</button>
            </div>
          </div>
        </div>
      )}

      {viewingDoc && (
        <FileViewerModal
          url={viewingDoc.driveLink}
          mimeType={viewingDoc.mimeType}
          fileName={viewingDoc.fileName}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Complete Design / Shade Card Approval Modal */}
      {showAdvanceModal && nextStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAdvanceModal(false); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Palette className="w-4 h-4 text-indigo-500" /> Complete Design Stage
              </h3>
              <button onClick={() => setShowAdvanceModal(false)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Step 1: Shade Card */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${shadeCardEntries.length > 0 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
                  <span className="text-sm font-semibold text-slate-800">Shade Card / Material Selection</span>
                  {shadeCardEntries.length > 0
                    ? <span className="ml-auto text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">{shadeCardEntries.length} entries</span>
                    : <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Not added</span>}
                </div>
                {shadeCardEntries.length === 0 && (
                  <p className="text-xs text-slate-500">Add shade card entries before proceeding. Use the Shade Card section below.</p>
                )}
              </div>

              {/* Step 2: Send to customer */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${shadeCardApproval ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
                  <span className="text-sm font-semibold text-slate-800">Send to Customer via WhatsApp</span>
                  {shadeCardPending && <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">Awaiting approval</span>}
                  {shadeCardApproved && <span className="ml-auto text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Approved ✓</span>}
                </div>
                {!shadeCardApproval && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">The material selection will be sent to <strong>{project.client?.name}</strong> for approval before advancing to Purchase.</p>
                    <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-600 font-mono whitespace-pre-wrap leading-relaxed">
                      {buildShadeCardMessage()}
                    </div>
                    <button
                      onClick={() => sendShadeCardApprovalMut.mutate()}
                      disabled={shadeCardEntries.length === 0 || sendShadeCardApprovalMut.isPending}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {sendShadeCardApprovalMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send to Customer for Approval
                    </button>
                  </div>
                )}
                {shadeCardPending && (
                  <p className="text-xs text-slate-500">Waiting for MD/GM to approve and forward to customer. Once approved, the advance button will unlock.</p>
                )}
              </div>

              {/* Step 3: Advance */}
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${shadeCardApproved ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-500'}`}>3</div>
                  <span className="text-sm font-semibold text-slate-800">Advance to {nextStage.name}</span>
                </div>
                <button
                  onClick={() => { setAdvancing(true); advanceMut.mutate(nextStage._id); }}
                  disabled={!shadeCardApproved || advancing || advanceMut.isPending}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {advancing || advanceMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  {shadeCardApproved ? `Advance to ${nextStage.name}` : 'Waiting for customer approval…'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
