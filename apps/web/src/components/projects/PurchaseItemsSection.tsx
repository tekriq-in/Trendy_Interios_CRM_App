'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, PackageCheck, Pencil, Plus, ShoppingCart, Trash2, Truck, Undo2, X } from 'lucide-react';
import {
  PERMISSIONS,
  PURCHASE_ITEM_STATUS_LABELS,
  purchaseItemMatchKey,
  type PurchaseItemStatus,
} from '@ti/shared';
import { apiClient } from '@/lib/api-client';
import { usePermissions } from '@/lib/usePermissions';
import { useToast } from '@/components/ui/Toast';

export interface PurchaseItemRow {
  _id: string;
  slNo: number;
  area: string;
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  quantity: number;
  receivedQty: number;
  balanceQty: number;
  status: PurchaseItemStatus;
}

interface ItemForm {
  area: string;
  item: string;
  brand: string;
  code: string;
  size: string;
  finish: string;
  quantity: string;
}

const EMPTY_FORM: ItemForm = { area: '', item: '', brand: '', code: '', size: '', finish: '', quantity: '' };

const TEXT_FIELDS: { key: Exclude<keyof ItemForm, 'quantity'>; label: string; placeholder: string; required?: boolean }[] = [
  { key: 'area', label: 'Area', placeholder: 'e.g. Kitchen' },
  { key: 'item', label: 'Item name', placeholder: 'e.g. Hinge', required: true },
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Hettich' },
  { key: 'code', label: 'Code', placeholder: 'e.g. H-35' },
  { key: 'size', label: 'Size', placeholder: 'e.g. 35mm' },
  { key: 'finish', label: 'Finish', placeholder: 'e.g. SS' },
];

const STATUS_STYLE: Record<PurchaseItemStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  ordered: 'bg-blue-50 text-blue-700 border-blue-200',
  received: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const ERROR_TEXT: Record<string, string> = {
  'purchase_item.duplicate': 'Another row already has exactly these details. Add the quantity to that row instead.',
  'purchase_item.quantity_below_received': 'Order qty cannot be less than the quantity already received.',
  'purchase_item.received_exceeds_order': 'Received qty cannot be more than the order qty.',
  'purchase_item.cannot_delete_in_progress': 'Only items that are still "Yet to order" with nothing received can be deleted.',
  'project.not_found': 'You do not have access to this project.',
};

export function apiErrorText(error: unknown, fallback: string): string {
  const msg = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  const first = Array.isArray(msg) ? msg[0] : msg;
  return (first && ERROR_TEXT[first]) || (Array.isArray(msg) ? msg.join(' ') : msg) || fallback;
}

export function fmtQty(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export function PurchaseStatusBadge({ status }: { status: PurchaseItemStatus }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}>
      {PURCHASE_ITEM_STATUS_LABELS[status]}
    </span>
  );
}

/** Purchase enters the total received so far. Manual. */
export function ReceiveQtyModal({ row, onClose, onSaved }: {
  row: PurchaseItemRow;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [value, setValue] = useState(String(row.receivedQty));
  const [err, setErr] = useState('');
  const num = Number(value);
  const invalid = value.trim() === '' || Number.isNaN(num) || num < 0 || num > row.quantity;

  const mut = useMutation({
    mutationFn: () => apiClient.patch(`/purchase-items/${row._id}/progress`, { receivedQty: num }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-items'] });
      toast('success', 'Received quantity updated.');
      onSaved?.();
      onClose();
    },
    onError: (e) => setErr(apiErrorText(e, 'Failed to update received quantity.')),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">Record received qty</h3>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-800">{row.item}</p>
            <p className="text-xs text-slate-400">{[row.area, row.brand, row.code, row.size, row.finish].filter(Boolean).join(' · ')}</p>
            <p className="mt-2">Order qty <b>{fmtQty(row.quantity)}</b> · received so far <b>{fmtQty(row.receivedQty)}</b></p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Total received</label>
            <div className="flex gap-2">
              <input type="number" min={0} max={row.quantity} step="any" value={value} autoFocus
                onChange={(e) => { setValue(e.target.value); setErr(''); }}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <button type="button" onClick={() => setValue(String(row.quantity))}
                className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
                All ({fmtQty(row.quantity)})
              </button>
            </div>
            {!invalid && <p className="mt-1 text-xs text-slate-400">Balance after save: {fmtQty(Math.max(0, row.quantity - num))}</p>}
            {invalid && value.trim() !== '' && <p className="mt-1 text-xs text-red-600">Enter a number from 0 to {fmtQty(row.quantity)}.</p>}
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={() => mut.mutate()} disabled={invalid || mut.isPending}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
              {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Mark ordered / back to yet to order. Shared by the project page and the global purchase page. */
export function usePurchaseStatusMutation() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pending' | 'ordered' }) =>
      apiClient.patch(`/purchase-items/${id}/progress`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchase-items'] }),
    onError: (e) => toast('error', apiErrorText(e, 'Failed to update status.')),
  });
}

export async function downloadPurchaseItemsPdf(projectId: string, projectTitle: string) {
  const res = await apiClient.get<Blob>(`/projects/${projectId}/purchase-items/pdf`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Purchase_Items_${projectTitle.replace(/[^\w-]+/g, '_') || projectId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function PurchaseItemsSection({ projectId, projectTitle }: { projectId: string; projectTitle: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = usePermissions();
  const canAdd = hasPermission(PERMISSIONS.PURCHASE_ITEMS_ADD);
  const canManage = hasPermission(PERMISSIONS.PURCHASE_ITEMS_MANAGE);

  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; row: PurchaseItemRow } | null>(null);
  const [form, setForm] = useState<ItemForm>(EMPTY_FORM);
  const [formErr, setFormErr] = useState('');
  const [receiving, setReceiving] = useState<PurchaseItemRow | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery<PurchaseItemRow[]>({
    queryKey: ['purchase-items', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}/purchase-items`).then((r) => r.data),
  });

  const statusMut = usePurchaseStatusMutation();

  const saveMut = useMutation({
    mutationFn: () => {
      const body = {
        area: form.area, item: form.item, brand: form.brand, code: form.code,
        size: form.size, finish: form.finish, quantity: Number(form.quantity),
      };
      return modal?.mode === 'edit'
        ? apiClient.patch(`/purchase-items/${modal.row._id}`, body)
        : apiClient.post<{ merged: boolean; quantity: number }>(`/projects/${projectId}/purchase-items`, body);
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['purchase-items'] });
      const data = res.data as { merged?: boolean; quantity: number };
      toast('success', modal?.mode === 'edit'
        ? 'Item updated.'
        : data.merged ? `Added to existing item — order qty is now ${fmtQty(data.quantity)}.` : 'Item added.');
      closeModal();
    },
    onError: (e) => setFormErr(apiErrorText(e, 'Failed to save item.')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/purchase-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-items'] });
      toast('success', 'Item deleted.');
    },
    onError: (e) => toast('error', apiErrorText(e, 'Failed to delete item.')),
  });

  // Live hint: will this add merge into an existing row?
  const mergeTarget = useMemo(() => {
    if (modal?.mode !== 'add' || !form.item.trim()) return null;
    const key = purchaseItemMatchKey(form);
    return rows.find((r) => purchaseItemMatchKey(r) === key) ?? null;
  }, [modal, form, rows]);

  const suggestions = useMemo(() => {
    const uniq = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
    return Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, uniq(rows.map((r) => r[f.key]))])) as Record<string, string[]>;
  }, [rows]);

  const counts = {
    pending: rows.filter((r) => r.status === 'pending').length,
    ordered: rows.filter((r) => r.status === 'ordered').length,
    received: rows.filter((r) => r.status === 'received').length,
  };

  function openAdd() {
    setForm(EMPTY_FORM);
    setFormErr('');
    setModal({ mode: 'add' });
  }

  function openEdit(row: PurchaseItemRow) {
    setForm({
      area: row.area, item: row.item, brand: row.brand, code: row.code,
      size: row.size, finish: row.finish, quantity: String(row.quantity),
    });
    setFormErr('');
    setModal({ mode: 'edit', row });
  }

  function closeModal() {
    setModal(null);
    setForm(EMPTY_FORM);
    setFormErr('');
  }

  async function exportPdf() {
    setExporting(true);
    try {
      await downloadPurchaseItemsPdf(projectId, projectTitle);
    } catch {
      toast('error', 'Failed to export PDF.');
    } finally {
      setExporting(false);
    }
  }

  const qtyNum = Number(form.quantity);
  const editMin = modal?.mode === 'edit' ? modal.row.receivedQty : 0;
  const qtyInvalid = form.quantity.trim() === '' || Number.isNaN(qtyNum) || qtyNum <= 0 || qtyNum < editMin;

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-700">
          <ShoppingCart className="h-4 w-4 text-slate-400" /> Purchase Items
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {rows.length > 0 && (
            <button onClick={exportPdf} disabled={exporting}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Export PDF
            </button>
          )}
          {canAdd && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700">
              <Plus className="h-3.5 w-3.5" /> Add Item
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {(['pending', 'ordered', 'received'] as const).map((s) => (
            <span key={s} className={`rounded-full border px-2.5 py-0.5 font-medium ${STATUS_STYLE[s]}`}>
              {PURCHASE_ITEM_STATUS_LABELS[s]}: {counts[s]}
            </span>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No purchase items yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-400">
                <th className="py-2 pr-2 text-left font-semibold">S.No</th>
                <th className="py-2 pr-2 text-left font-semibold">Area</th>
                <th className="py-2 pr-2 text-left font-semibold">Item name</th>
                <th className="py-2 pr-2 text-left font-semibold">Brand</th>
                <th className="py-2 pr-2 text-left font-semibold">Code</th>
                <th className="py-2 pr-2 text-left font-semibold">Size</th>
                <th className="py-2 pr-2 text-left font-semibold">Finish</th>
                <th className="py-2 pr-2 text-right font-semibold">Order qty</th>
                <th className="py-2 pr-2 text-right font-semibold">Received qty</th>
                <th className="py-2 pr-2 text-right font-semibold">Balance qty</th>
                <th className="py-2 pr-2 text-left font-semibold">Status</th>
                <th className="py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row._id} className="align-top">
                  <td className="py-2.5 pr-2 font-mono text-xs text-slate-400">{row.slNo}</td>
                  <td className="py-2.5 pr-2 text-slate-600">{row.area || '—'}</td>
                  <td className="py-2.5 pr-2 font-medium text-slate-800">{row.item}</td>
                  <td className="py-2.5 pr-2 text-slate-600">{row.brand || '—'}</td>
                  <td className="py-2.5 pr-2 text-slate-600">{row.code || '—'}</td>
                  <td className="py-2.5 pr-2 text-slate-600">{row.size || '—'}</td>
                  <td className="py-2.5 pr-2 text-slate-600">{row.finish || '—'}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-slate-800">{fmtQty(row.quantity)}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-emerald-700">{fmtQty(row.receivedQty)}</td>
                  <td className={`py-2.5 pr-2 text-right font-semibold tabular-nums ${row.balanceQty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {fmtQty(row.balanceQty)}
                  </td>
                  <td className="py-2.5 pr-2"><PurchaseStatusBadge status={row.status} /></td>
                  <td className="py-2.5">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {canManage && row.status === 'pending' && (
                        <button onClick={() => statusMut.mutate({ id: row._id, status: 'ordered' })} disabled={statusMut.isPending}
                          className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50">
                          <Truck className="h-3.5 w-3.5" /> Mark ordered
                        </button>
                      )}
                      {canManage && row.status === 'ordered' && (
                        <button onClick={() => statusMut.mutate({ id: row._id, status: 'pending' })} disabled={statusMut.isPending}
                          title="Back to yet to order"
                          className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50">
                          <Undo2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canManage && (
                        <button onClick={() => setReceiving(row)}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
                          <PackageCheck className="h-3.5 w-3.5" /> Receive
                        </button>
                      )}
                      {canAdd && (
                        <button onClick={() => openEdit(row)} title="Edit item" aria-label={`Edit ${row.item}`}
                          className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canAdd && row.status === 'pending' && row.receivedQty === 0 && (
                        <button
                          onClick={() => { if (window.confirm(`Delete "${row.item}"?`)) deleteMut.mutate(row._id); }}
                          title="Delete item" aria-label={`Delete ${row.item}`}
                          className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-semibold text-slate-900">{modal.mode === 'edit' ? 'Edit Purchase Item' : 'Add Purchase Item'}</h3>
              <button onClick={closeModal} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {TEXT_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <input type="text" value={form[f.key]} placeholder={f.placeholder} list={`pi-${f.key}-options`}
                      onChange={(e) => { setForm((p) => ({ ...p, [f.key]: e.target.value })); setFormErr(''); }}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    <datalist id={`pi-${f.key}-options`}>
                      {suggestions[f.key]?.map((v) => <option key={v} value={v} />)}
                    </datalist>
                  </div>
                ))}
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    {modal.mode === 'edit' ? 'Order qty (total)' : 'Quantity to add'} <span className="text-red-500">*</span>
                  </label>
                  <input type="number" min={modal.mode === 'edit' ? Math.max(editMin, 0.001) : 0.001} step="any" value={form.quantity}
                    onChange={(e) => { setForm((p) => ({ ...p, quantity: e.target.value })); setFormErr(''); }}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  {modal.mode === 'edit' && editMin > 0 && (
                    <p className="mt-1 text-xs text-slate-400">At least {fmtQty(editMin)} (already received)</p>
                  )}
                </div>
              </div>

              {mergeTarget && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Matches existing item <b>#{mergeTarget.slNo}</b> — order qty will go from <b>{fmtQty(mergeTarget.quantity)}</b> to{' '}
                  <b>{fmtQty(mergeTarget.quantity + (qtyInvalid ? 0 : qtyNum))}</b>
                  {mergeTarget.receivedQty > 0 && <> ({fmtQty(mergeTarget.receivedQty)} already received)</>}, and the balance will be marked “Yet to order”.
                </div>
              )}

              {formErr && <p className="text-xs text-red-600">{formErr}</p>}

              <div className="flex gap-3 pt-1">
                <button onClick={closeModal} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button onClick={() => saveMut.mutate()} disabled={!form.item.trim() || qtyInvalid || saveMut.isPending}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {modal.mode === 'edit' ? 'Save Changes' : mergeTarget ? 'Add to Existing' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {receiving && <ReceiveQtyModal row={receiving} onClose={() => setReceiving(null)} />}
    </div>
  );
}
