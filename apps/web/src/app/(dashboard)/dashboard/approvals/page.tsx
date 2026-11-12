'use client';

import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth.store';
import { PERMISSIONS } from '@ti/shared';
import { usePermissions } from '@/lib/usePermissions';
import { useToast } from '@/components/ui/Toast';
import { SkeletonCard } from '@/components/ui/Skeleton';
import { FileViewerModal } from '@/components/ui/FileViewerModal';
import {
  CheckCircle, XCircle, Sparkles, Send, ChevronDown, ChevronUp, X, Loader2, Paperclip,
  ExternalLink, FileText, MessageCircle, Check, CheckCheck, Eye, AlertCircle, Clock,
} from 'lucide-react';

interface NameObj { name: string }
interface LinkedDocument {
  _id: string;
  fileName: string;
  driveLink: string;
  mimeType: string;
  type?: string;
}
interface Approval {
  _id: string;
  status: 'pending' | 'approved' | 'rejected';
  kind: string;
  project?: NameObj | { _id: string; title: string; client?: { name: string; phone: string } } | string;
  requestedBy?: NameObj | string;
  approver?: NameObj | string;
  rawNotes?: string;
  generatedMessage?: string;
  rejectionReason?: string;
  createdAt?: string;
  whatsappScheduled?: boolean;
  whatsappDeliveryStatus?: 'sent' | 'delivered' | 'read' | 'failed';
  customerConfirmed?: boolean;
  linkedDocument?: LinkedDocument;
}

interface ClientMessage {
  _id: string;
  client?: { name: string; phone: string };
  project?: { title: string };
  linkedApproval?: { kind: string; generatedMessage?: string };
  body: string;
  isRead: boolean;
  receivedAt?: string;
  createdAt?: string;
}

const KIND_LABELS: Record<string, { label: string; color: string }> = {
  quotation:          { label: 'Quotation',         color: 'bg-blue-50 text-blue-700 ring-blue-200' },
  order_confirmation: { label: 'Order Confirmation', color: 'bg-violet-50 text-violet-700 ring-violet-200' },
  client_update:      { label: 'Client Update',      color: 'bg-amber-50 text-amber-700 ring-amber-200' },
  drawing:            { label: 'Drawing',             color: 'bg-teal-50 text-teal-700 ring-teal-200' },
  customer_sign_off:  { label: 'Customer Sign-Off',  color: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  shade_card:         { label: 'Shade Card Approval', color: 'bg-indigo-50 text-indigo-700 ring-indigo-200' },
};

function DeliveryChip({ status }: { status?: string }) {
  if (!status) return null;
  const cfg: Record<string, { icon: React.ReactNode; label: string; cls: string }> = {
    sent:      { icon: <Check className="w-3 h-3" />,        label: 'Sent',      cls: 'text-slate-500' },
    delivered: { icon: <CheckCheck className="w-3 h-3" />,   label: 'Delivered', cls: 'text-slate-600' },
    read:      { icon: <CheckCheck className="w-3 h-3" />,   label: 'Read',      cls: 'text-blue-600' },
    failed:    { icon: <AlertCircle className="w-3 h-3" />,  label: 'Failed',    cls: 'text-red-500' },
  };
  const c = cfg[status];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${c.cls}`}>
      {c.icon} {c.label}
    </span>
  );
}

function nameOf(v: NameObj | string | undefined) {
  if (!v) return '—';
  return typeof v === 'object' && 'name' in v ? v.name : typeof v === 'string' ? v : '—';
}
function projectTitle(v: Approval['project']) {
  if (!v) return '—';
  if (typeof v === 'object' && 'title' in v) return v.title;
  if (typeof v === 'object' && 'name' in v) return (v as NameObj).name;
  return '—';
}

type Tab = 'pending' | 'history' | 'replies';

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const userId = useAuthStore((state) => state.user?.id);
  const { hasPermission } = usePermissions();
  const canDecide = hasPermission(PERMISSIONS.APPROVALS_DECIDE);
  const canRequest = hasPermission(PERMISSIONS.APPROVALS_REQUEST);
  const requesterOnly = canRequest && !canDecide;

  const [activeTab, setActiveTab] = useState<Tab>('pending');

  // reject state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // expand/edit generated message per approval
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  // "Request approval" modal
  const [showRequest, setShowRequest] = useState(false);
  const [reqForm, setReqForm] = useState({
    projectId: '', kind: 'client_update', rawNotes: '', language: 'en' as 'en' | 'ta',
  });
  const [generating, setGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState('');
  const [translatedNotes, setTranslatedNotes] = useState('');
  const [reqSaving, setReqSaving] = useState(false);
  const [reqErr, setReqErr] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [uploadedDocId, setUploadedDocId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [viewingDoc, setViewingDoc] = useState<LinkedDocument | null>(null);

  const { data: approvals = [], isLoading, isError } = useQuery<Approval[]>({
    queryKey: ['approvals', canDecide ? 'all' : 'mine', userId],
    queryFn: () => apiClient.get(canDecide ? '/approvals' : '/approvals/mine').then(r => r.data),
    enabled: canDecide || canRequest,
    refetchInterval: requesterOnly ? 30_000 : false,
    retry: 1,
  });

  const { data: clientMessages = [], isLoading: repliesLoading } = useQuery<ClientMessage[]>({
    queryKey: ['client-messages'],
    queryFn: () => apiClient.get('/webhooks/client-messages').then(r => r.data),
    enabled: canDecide && activeTab === 'replies',
    refetchInterval: activeTab === 'replies' ? 30_000 : false,
  });

  const markReadMut = useMutation({
    mutationFn: (id: string) => apiClient.patch(`/webhooks/client-messages/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['client-messages'] }),
  });

  const { data: projects = [] } = useQuery<Array<{ _id: string; title: string }>>({
    queryKey: ['projects'],
    queryFn: () => apiClient.get('/projects').then(r => r.data),
    enabled: showRequest && canRequest,
  });

  const approveMut = useMutation({
    mutationFn: ({ id, finalMessage }: { id: string; finalMessage?: string }) =>
      apiClient.patch(`/approvals/${id}/approve`, { finalMessage }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard-approvals'] });
      toast('success', 'Approval sent — WhatsApp message dispatched.');
    },
    onError: () => toast('error', 'Failed to approve. Please try again.'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      apiClient.patch(`/approvals/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard-approvals'] });
      setRejectingId(null); setRejectReason('');
      toast('warning', 'Approval rejected.');
    },
    onError: () => toast('error', 'Failed to reject. Please try again.'),
  });

  async function handleFileAttach(file: File) {
    setAttachedFile(file);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (reqForm.projectId) fd.append('projectId', reqForm.projectId);
      fd.append('type', reqForm.kind === 'drawing' ? 'drawing_2d' : 'other');
      const res = await apiClient.post<{ _id: string }>('/documents/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadedDocId(res.data._id);
    } catch {
      setReqErr('File upload failed. You can still submit without a document.');
      setAttachedFile(null);
    } finally { setUploading(false); }
  }

  async function handleGenerate() {
    if (!reqForm.rawNotes.trim()) { setReqErr('Add some notes first.'); return; }
    const proj = projects.find(p => p._id === reqForm.projectId);
    setGenerating(true); setReqErr(''); setGeneratedMsg(''); setTranslatedNotes('');
    try {
      const res = await apiClient.post<{ message: string; translatedNotes?: string }>('/approvals/generate-message', {
        rawNotes: reqForm.rawNotes,
        clientName: 'Valued Client',
        projectTitle: proj?.title ?? 'your project',
        updateKind: reqForm.kind,
        language: reqForm.language,
      });
      setGeneratedMsg(res.data.message);
      setTranslatedNotes(res.data.translatedNotes ?? '');
    } catch (e: unknown) {
      const responseMessage = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setReqErr(Array.isArray(responseMessage)
        ? responseMessage.join(' ')
        : responseMessage ?? 'Failed to generate message. Check the AI provider configuration and try again.');
    } finally { setGenerating(false); }
  }

  async function handleSubmitRequest() {
    if (!reqForm.projectId) { setReqErr('Select a project.'); return; }
    if (reqForm.kind === 'client_update' && !generatedMsg.trim()) {
      setReqErr('Generate or type a message first.'); return;
    }
    setReqSaving(true); setReqErr('');
    try {
      await apiClient.post('/approvals', {
        projectId: reqForm.projectId,
        kind: reqForm.kind,
        rawNotes: reqForm.language === 'ta' && translatedNotes ? translatedNotes : reqForm.rawNotes,
        generatedMessage: generatedMsg,
        ...(uploadedDocId ? { linkedDocumentId: uploadedDocId } : {}),
      });
      qc.invalidateQueries({ queryKey: ['approvals'] });
      qc.invalidateQueries({ queryKey: ['dashboard-approvals'] });
      toast('success', 'Approval request submitted.');
      setShowRequest(false);
      setReqForm({ projectId: '', kind: 'client_update', rawNotes: '', language: 'en' });
      setGeneratedMsg('');
      setTranslatedNotes('');
      setAttachedFile(null);
      setUploadedDocId(null);
    } catch (e: unknown) {
      setReqErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to submit.');
    } finally { setReqSaving(false); }
  }

  const pending  = approvals.filter(a => a.status === 'pending');
  const resolved = approvals.filter(a => a.status !== 'pending');
  const unreadReplies = clientMessages.filter(m => !m.isRead).length;

  const inputCls = 'w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

  const tabCls = (t: Tab) =>
    `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-indigo-500 text-indigo-600'
        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
    }`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Approvals</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {requesterOnly ? 'Track the status of approval requests you submitted.' : 'Review and approve client updates — AI-drafted messages sent via WhatsApp after approval.'}
          </p>
        </div>
        {canRequest && <button
          onClick={() => { setShowRequest(true); setGeneratedMsg(''); setReqErr(''); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
        >
          <Send className="w-4 h-4" /> Request Approval
        </button>}
      </div>

      {requesterOnly ? (
        isLoading ? (
          <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-6 text-center">
            <p className="text-sm font-semibold text-red-700">Failed to load your approval requests.</p>
          </div>
        ) : approvals.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">You haven’t submitted any approval requests yet.</p>
        ) : (
          <section aria-label="My approval requests" className="space-y-3">
            {approvals.map((approval) => {
              const kindInfo = KIND_LABELS[approval.kind] ?? { label: approval.kind, color: 'bg-slate-100 text-slate-600 ring-slate-200' };
              return (
                <article key={approval._id} className="rounded-xl border border-slate-200 bg-white px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${kindInfo.color}`}>{kindInfo.label}</span>
                        <span className="truncate text-sm font-semibold text-slate-900">{projectTitle(approval.project)}</span>
                      </div>
                      {approval.createdAt && <p className="mt-1 text-xs text-slate-500">Submitted {new Date(approval.createdAt).toLocaleDateString('en-IN')}</p>}
                      {approval.rejectionReason && <p className="mt-2 text-sm text-red-600">Reason: {approval.rejectionReason}</p>}
                      {approval.status === 'approved' && approval.approver && <p className="mt-2 text-xs text-emerald-700">Approved by {nameOf(approval.approver)}</p>}
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${approval.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : approval.status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                      {approval.status}
                    </span>
                  </div>
                </article>
              );
            })}
          </section>
        )
      ) : (
        <>
      {/* ── Tab bar ── */}
      <div className="border-b border-slate-200 flex gap-0 -mb-2">
        <button className={tabCls('pending')} onClick={() => setActiveTab('pending')}>
          Pending
          {pending.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
              {pending.length}
            </span>
          )}
        </button>
        <button className={tabCls('history')} onClick={() => setActiveTab('history')}>
          History
        </button>
        {canDecide && <button className={tabCls('replies')} onClick={() => setActiveTab('replies')}>
          <MessageCircle className="w-3.5 h-3.5" />
          Client Replies
          {unreadReplies > 0 && (
            <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center">
              {unreadReplies}
            </span>
          )}
        </button>}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : isError ? (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-6 text-center">
          <p className="text-sm font-semibold text-red-700">Failed to load approvals.</p>
          <p className="text-xs text-red-500 mt-1">You may not have permission to view this page, or the server returned an error.</p>
        </div>
      ) : (
        <>
          {/* ── Pending Tab ── */}
          {activeTab === 'pending' && <section className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-8 text-center">No pending approvals.</p>
            ) : (
              pending.map((a) => {
                const kindInfo = KIND_LABELS[a.kind] ?? { label: a.kind, color: 'bg-slate-100 text-slate-600 ring-slate-200' };
                const isExpanded = expandedId === a._id;
                const editedMsg = editedMessages[a._id] ?? a.generatedMessage ?? '';

                return (
                  <div key={a._id} className="bg-white border border-slate-200 border-l-4 border-l-amber-400 rounded-xl overflow-hidden">
                    {/* Header row */}
                    <div className="px-5 py-4 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ring-1 ring-inset ${kindInfo.color}`}>
                            {kindInfo.label}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 truncate">{projectTitle(a.project)}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Requested by {nameOf(a.requestedBy)}
                          {a.createdAt && ` · ${new Date(a.createdAt).toLocaleDateString('en-IN')}`}
                        </p>
                        {a.rawNotes && (
                          <p className="text-xs text-slate-400 mt-1 italic">Notes: "{a.rawNotes}"</p>
                        )}
                        {a.linkedDocument && (
                          <div className="inline-flex items-center gap-0.5 mt-1 bg-slate-50 border border-slate-200 rounded-md overflow-hidden">
                            <button
                              onClick={() => setViewingDoc(a.linkedDocument!)}
                              className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:bg-indigo-50 px-2 py-1 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              {a.linkedDocument.fileName}
                            </button>
                            <a
                              href={a.linkedDocument.driveLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-1.5 py-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 border-l border-slate-200 transition-colors"
                              title="Open in new tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 shrink-0">
                        Pending
                      </span>
                    </div>

                    {/* Message preview (client_update only) */}
                    {a.kind === 'client_update' && a.generatedMessage && (
                      <div className="border-t border-slate-100">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a._id)}
                          className="w-full flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          AI-drafted WhatsApp message
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 ml-auto" /> : <ChevronDown className="w-3.5 h-3.5 ml-auto" />}
                        </button>
                        {isExpanded && (
                          <div className="px-5 pb-4 space-y-2">
                            <p className="text-xs text-slate-500">Review and edit before approving:</p>
                            <textarea
                              value={editedMsg}
                              onChange={e => setEditedMessages(prev => ({ ...prev, [a._id]: e.target.value }))}
                              rows={6}
                              className="w-full border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
                            />
                            <p className="text-xs text-slate-400 text-right">{editedMsg.length} chars</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 flex flex-wrap gap-2 items-center">
                      <button
                        onClick={() => approveMut.mutate({
                          id: a._id,
                          finalMessage: editedMessages[a._id] ?? a.generatedMessage,
                        })}
                        disabled={approveMut.isPending}
                        className="flex items-center gap-2 text-sm font-semibold bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <CheckCircle className="w-4 h-4" />
                        {a.kind === 'client_update' ? 'Approve & Send WhatsApp' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setRejectingId(a._id); setRejectReason(''); }}
                        className="flex items-center gap-2 text-sm font-semibold bg-white text-red-600 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>

                    {/* Inline reject form */}
                    {rejectingId === a._id && (
                      <div className="border-t border-slate-100 px-5 py-3 flex gap-2">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={e => setRejectReason(e.target.value)}
                          placeholder="Reason for rejection…"
                          className="flex-1 border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                        />
                        <button
                          onClick={() => rejectMut.mutate({ id: a._id, reason: rejectReason })}
                          disabled={!rejectReason.trim() || rejectMut.isPending}
                          className="text-xs font-semibold bg-red-600 text-white px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                          {rejectMut.isPending ? '…' : 'Submit'}
                        </button>
                        <button onClick={() => setRejectingId(null)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </section>}

          {/* ── History Tab ── */}
          {activeTab === 'history' && <section className="space-y-2">
            {resolved.length === 0 ? (
              <p className="text-sm text-slate-400 bg-slate-50 rounded-xl px-4 py-8 text-center">No approval history yet.</p>
            ) : (
              resolved.map(a => {
                const kindInfo = KIND_LABELS[a.kind] ?? { label: a.kind, color: 'bg-slate-100 text-slate-600 ring-slate-200' };
                return (
                  <div key={a._id} className="bg-white border border-slate-200 rounded-xl px-5 py-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ring-1 ring-inset ${kindInfo.color}`}>
                            {kindInfo.label}
                          </span>
                          <span className="text-sm font-medium text-slate-700">{projectTitle(a.project)}</span>
                          {a.whatsappScheduled && <DeliveryChip status={a.whatsappDeliveryStatus ?? 'sent'} />}
                          {a.customerConfirmed && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <CheckCircle className="w-3 h-3" /> Client confirmed
                            </span>
                          )}
                        </div>
                        {a.rejectionReason && (
                          <p className="text-xs text-red-500 mt-1">Rejected: {a.rejectionReason}</p>
                        )}
                        {a.generatedMessage && a.status === 'approved' && (
                          <p className="text-xs text-slate-500 mt-1 italic truncate max-w-md">{a.generatedMessage}</p>
                        )}
                        {a.linkedDocument && (
                          <a href={a.linkedDocument.driveLink} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:underline mt-1"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {a.linkedDocument.fileName}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 ${
                        a.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </section>}

          {/* ── Client Replies Tab ── */}
          {activeTab === 'replies' && <section className="space-y-3">
            <p className="text-xs text-slate-400">
              Inbound WhatsApp replies from clients. Confirmations are automatically applied to their linked approval.
            </p>
            {repliesLoading ? (
              <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)}</div>
            ) : clientMessages.length === 0 ? (
              <div className="bg-slate-50 rounded-xl px-5 py-10 text-center">
                <MessageCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No client replies yet.</p>
                <p className="text-xs text-slate-400 mt-1">Replies will appear here when clients respond to WhatsApp messages.</p>
              </div>
            ) : (
              clientMessages.map(m => {
                const ts = m.receivedAt ?? m.createdAt;
                return (
                  <div key={m._id} className={`bg-white border rounded-xl px-5 py-4 ${m.isRead ? 'border-slate-200 opacity-75' : 'border-green-300 shadow-sm'}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-slate-800">{m.client?.name ?? 'Client'}</span>
                          {m.project && (
                            <span className="text-xs text-slate-400">· {m.project.title}</span>
                          )}
                          {!m.isRead && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold ring-1 ring-inset ring-green-200">
                              Unread
                            </span>
                          )}
                        </div>
                        {m.linkedApproval && (
                          <p className="text-xs text-slate-400 mb-1">
                            Re: {KIND_LABELS[m.linkedApproval.kind]?.label ?? m.linkedApproval.kind}
                            {m.linkedApproval.generatedMessage && (
                              <span className="italic"> — "{m.linkedApproval.generatedMessage.slice(0, 60)}…"</span>
                            )}
                          </p>
                        )}
                        <p className="text-sm text-slate-700 bg-green-50 rounded-lg px-3 py-2 inline-block max-w-md">
                          {m.body}
                        </p>
                        {ts && (
                          <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        {m.client?.phone && (
                          <span className="text-xs text-slate-400">{m.client.phone}</span>
                        )}
                        {!m.isRead && (
                          <button
                            onClick={() => markReadMut.mutate(m._id)}
                            disabled={markReadMut.isPending}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Mark read
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </section>}
        </>
      )}
        </>
      )}

      {/* ── Request Approval Modal ── */}
      {showRequest && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 px-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mb-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-900">Request Approval</h2>
              <button onClick={() => { setShowRequest(false); setTranslatedNotes(''); }} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Project</label>
                <select
                  value={reqForm.projectId}
                  onChange={e => {
                    setReqForm(p => ({ ...p, projectId: e.target.value }));
                    setGeneratedMsg(''); setTranslatedNotes('');
                  }}
                  className={inputCls}
                >
                  <option value="">Select project…</option>
                  {projects.map(p => <option key={p._id} value={p._id}>{p.title}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Approval type</label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(KIND_LABELS).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setReqForm(p => ({ ...p, kind: k }));
                        setGeneratedMsg(''); setTranslatedNotes('');
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold text-left transition-colors ${
                        reqForm.kind === k
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {reqForm.kind === 'client_update' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Staff notes (raw)</label>
                    <textarea
                      value={reqForm.rawNotes}
                      onChange={e => {
                        setReqForm(p => ({ ...p, rawNotes: e.target.value }));
                        setTranslatedNotes(''); setGeneratedMsg('');
                      }}
                      rows={3}
                      placeholder="e.g. Tiles arrived, work resumes Thursday, slight 2-day delay from supplier"
                      className={`${inputCls} resize-none`}
                    />
                    {reqForm.language === 'ta' && translatedNotes && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-medium text-slate-500">Tamil translation (stored as staff notes):</p>
                        <textarea
                          value={translatedNotes}
                          onChange={e => setTranslatedNotes(e.target.value)}
                          rows={3}
                          className={`${inputCls} resize-none bg-amber-50 border-amber-200 text-slate-800`}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Language</label>
                      <div className="flex gap-2">
                        {(['en', 'ta'] as const).map(l => (
                          <button
                            key={l}
                            onClick={() => {
                              setReqForm(p => ({ ...p, language: l }));
                              setGeneratedMsg(''); setTranslatedNotes(''); setReqErr('');
                            }}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                              reqForm.language === l
                                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                : 'border-slate-200 text-slate-600'
                            }`}
                          >
                            {l === 'en' ? 'English' : 'Tamil'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={generating || !reqForm.rawNotes.trim()}
                      className="ml-auto flex items-center gap-2 bg-violet-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 transition-colors"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                      {generating ? 'Generating…' : 'Generate with AI'}
                    </button>
                  </div>

                  {generatedMsg && (
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">
                        AI-drafted message <span className="text-slate-400 font-normal">(edit before submitting)</span>
                      </label>
                      <textarea
                        value={generatedMsg}
                        onChange={e => setGeneratedMsg(e.target.value)}
                        rows={7}
                        className={`${inputCls} resize-none font-mono leading-relaxed text-slate-800`}
                      />
                      <p className="text-xs text-slate-400 text-right">{generatedMsg.length} chars</p>
                    </div>
                  )}
                </>
              )}

              {/* Document attachment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Attach document <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.dwg,.dxf"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileAttach(f); }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 border border-dashed border-slate-300 rounded-lg px-4 py-2.5 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 w-full"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploading ? 'Uploading…' : attachedFile ? attachedFile.name : 'Click to attach a file'}
                </button>
                {uploadedDocId && (
                  <p className="text-xs text-emerald-600 mt-1">Document uploaded successfully.</p>
                )}
              </div>

              {reqErr && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{reqErr}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
              <button onClick={() => setShowRequest(false)} className="px-4 py-2 text-sm text-slate-600 font-medium">
                Cancel
              </button>
              <button
                onClick={handleSubmitRequest}
                disabled={reqSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {reqSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {reqSaving ? 'Submitting…' : 'Submit for Approval'}
              </button>
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
    </div>
  );
}
