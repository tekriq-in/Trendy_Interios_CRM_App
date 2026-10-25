'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ProjectChat } from '@/components/chat/ProjectChat';
import { useToast } from '@/components/ui/Toast';
import { ArrowLeft, ChevronRight, CheckCircle2, Loader2, UserPlus, X, Upload, FileText, ExternalLink, Plus, ClipboardList } from 'lucide-react';
import { FileUpload, UploadedFile } from '@/components/ui/FileUpload';

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

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  completed: 'bg-blue-50 text-blue-700',
  cancelled: 'bg-red-50 text-red-700',
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
  const [advancing, setAdvancing] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [drawingType, setDrawingType] = useState<'drawing_2d' | 'drawing_3d'>('drawing_2d');
  const [drawingUploading, setDrawingUploading] = useState(false);
  const [drawingErr, setDrawingErr] = useState('');
  const drawingInputRef = useRef<HTMLInputElement>(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskForm>(EMPTY_TASK);
  const [taskPhotos, setTaskPhotos] = useState<UploadedFile[]>([]);
  const [taskErr, setTaskErr] = useState('');

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

  const advanceMut = useMutation({
    mutationFn: (nextStageId: string) =>
      apiClient.post(`/projects/${id}/advance-stage`, { nextStageId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', id] });
      setAdvancing(false);
      toast('success', 'Stage advanced successfully.');
    },
    onError: () => { setAdvancing(false); toast('error', 'Failed to advance stage.'); },
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

  if (isLoading) return <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (!project) return <p className="text-sm text-red-500">Project not found.</p>;

  const currentStageId = typeof project.currentStage === 'object' ? project.currentStage?._id : project.currentStage;
  const completedStageIds = new Set((project.stageHistory ?? []).filter((h) => h.completedAt).map((h) => typeof h.stage === 'object' ? h.stage._id : h.stage));

  const sortedDepts = [...departments].sort((a, b) => a.order - b.order);
  const currentIdx = sortedDepts.findIndex((d) => d._id === currentStageId);

  // When current stage is deactivated it won't appear in sortedDepts (active only).
  // Fall back to the first active dept whose order is greater than the current stage's order.
  const currentStageOrder = typeof project.currentStage === 'object' ? project.currentStage?.order ?? -1 : -1;
  const nextStage: Dept | null = currentIdx >= 0 && currentIdx < sortedDepts.length - 1
    ? sortedDepts[currentIdx + 1]
    : currentIdx === -1 && currentStageOrder >= 0
      ? sortedDepts.find((d) => d.order > currentStageOrder) ?? null
      : null;

  const teamIds = new Set((project.assignedTeam ?? []).map((m) => m._id));

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
              {(project.status ?? 'active').replace('_', ' ')}
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
          {nextStage && project.status === 'active' && (
            <button
              onClick={() => { setAdvancing(true); advanceMut.mutate(nextStage._id); }}
              disabled={advancing || advanceMut.isPending}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {advancing || advanceMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Advance to {nextStage.name}
            </button>
          )}
          {!nextStage && project.status === 'active' && (
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
            <button onClick={() => setShowTeamModal(true)} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Manage
            </button>
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
                  <button onClick={() => toggleTeamMember(m._id)} className="ml-auto p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tasks */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Tasks</h2>
            <button
              onClick={() => { setShowTaskModal(true); setTaskForm(EMPTY_TASK); setTaskPhotos([]); setTaskErr(''); }}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-400">No tasks yet.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const nextStatus = task.status === 'pending' ? 'in_progress' : task.status === 'in_progress' ? 'done' : null;
                return (
                  <div key={task._id} className="flex items-center gap-3 bg-slate-50 rounded-lg px-3 py-2.5">
                    <button
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
                    </button>
                    <span className={`text-sm flex-1 truncate ${task.status === 'done' ? 'line-through text-slate-400' : 'text-slate-800'}`}>{task.title}</span>
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
                <span className="text-xs text-slate-400 shrink-0 uppercase">{d.type.replace('drawing_', '')}</span>
                <a href={d.driveLink} target="_blank" rel="noreferrer" className="p-1 text-slate-400 hover:text-indigo-600 shrink-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
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
              <button
                onClick={() => createTaskMut.mutate(taskForm)}
                disabled={!taskForm.title.trim() || !taskForm.departmentId || !taskForm.assignedToId || createTaskMut.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createTaskMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {createTaskMut.isPending ? 'Creating…' : 'Create Task'}
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
    </div>
  );
}
