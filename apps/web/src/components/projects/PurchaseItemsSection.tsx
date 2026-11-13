'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Info, Loader2, Minus, PackageCheck, Pencil, Plus, ShoppingCart, Trash2, Truck, X } from 'lucide-react';
import {
  PERMISSIONS,
  PURCHASE_ITEM_STATUS_LABELS,
  derivePurchaseItemStatus,
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
  orderedQty: number;
  receivedQty: number;
  yetToOrderQty: number;
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
  'purchase_item.quantity_below_ordered': 'Order qty cannot be less than the quantity already ordered.',
  'purchase_item.received_exceeds_order': 'Received qty cannot be more than the order qty.',
  'purchase_item.ordered_exceeds_order': 'Ordered qty cannot be more than the order qty.',
  'purchase_item.ordered_below_received': 'Ordered qty cannot be less than the quantity already received.',
  'purchase_item.cannot_delete_in_progress': 'Only items with nothing ordered or received can be deleted.',
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

/** Stacked bar: received (green) · ordered, not yet received (blue) · yet to order (grey). */
export function PurchaseProgressBar({ row }: { row: Pick<PurchaseItemRow, 'quantity' | 'orderedQty' | 'receivedQty'> }) {
  const total = row.quantity || 1;
  const received = Math.min(100, (row.receivedQty / total) * 100);
  const orderedOnly = Math.max(0, Math.min(100 - received, ((row.orderedQty - row.receivedQty) / total) * 100));
  return (
    <div className="mt-1.5 flex h-1.5 w-full min-w-[80px] overflow-hidden rounded-full bg-slate-100"
      title={`Ordered ${fmtQty(row.orderedQty)} · Received ${fmtQty(row.receivedQty)} of ${fmtQty(row.quantity)}`}>
      <div className="bg-emerald-500" style={{ width: `${received}%` }} />
      <div className="bg-blue-400" style={{ width: `${orderedOnly}%` }} />
    </div>
  );
}

export type QtyMode = 'ordered' | 'received';

/** Purchase enters the total ordered / received so far. Manual. */
export function QtyUpdateModal({ row, mode, onClose }: { row: PurchaseItemRow; mode: QtyMode; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const isOrdered = mode === 'ordered';
  const current = isOrdered ? row.orderedQty : row.receivedQty;
  const [value, setValue] = useState(String(current));
  const [err, setErr] = useState('');

  const num = Number(value);
  const isNumber = value.trim() !== '' && !Number.isNaN(num);
  const min = isOrdered ? row.receivedQty : 0;
  const tooHigh = isNumber && num > row.quantity;
  const tooLow = isNumber && num < min;
  const invalid = !isNumber || num < 0 || tooHigh || tooLow;

  // Preview what the row will look like after saving
  const nextOrdered = isOrdered ? num : Math.max(row.orderedQty, num);
  const nextReceived = isOrdered ? row.receivedQty : num;
  const raisesOrdered = !isOrdered && isNumber && num > row.orderedQty;
  const nextStatus = invalid ? row.status : derivePurchaseItemStatus(row.quantity, nextOrdered, nextReceived);

  const mut = useMutation({
    mutationFn: () => apiClient.patch(`/purchase-items/${row._id}/progress`, isOrdered ? { orderedQty: num } : { receivedQty: num }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['purchase-items'] });
      toast('success', isOrdered ? 'Ordered quantity updated.' : 'Received quantity updated.');
      onClose();
    },
    onError: (e) => setErr(apiErrorText(e, 'Failed to save.')),
  });

  const step = (delta: number) => {
    const base = isNumber ? num : current;
    setValue(String(Math.min(row.quantity, Math.max(min, Math.round((base + delta) * 1000) / 1000))));
    setErr('');
  };

  const quickPicks: { label: string; value: number }[] = isOrdered
    ? [{ label: `All (${fmtQty(row.quantity)})`, value: row.quantity }]
    : [
        ...(row.orderedQty > row.receivedQty && row.orderedQty < row.quantity
          ? [{ label: `All ordered (${fmtQty(row.orderedQty)})`, value: row.orderedQty }]
          : []),
        { label: `All (${fmtQty(row.quantity)})`, value: row.quantity },
      ];

  const accent = isOrdered
    ? { icon: Truck, ring: 'bg-blue-50 text-blue-600', button: 'bg-blue-600 hover:bg-blue-700', focus: 'focus:ring-blue-500', tile: 'border-blue-300 bg-blue-50' }
    : { icon: PackageCheck, ring: 'bg-emerald-50 text-emerald-600', button: 'bg-emerald-600 hover:bg-emerald-700', focus: 'focus:ring-emerald-500', tile: 'border-emerald-300 bg-emerald-50' };
  const Icon = accent.icon;
  const details = [row.area, row.brand, row.code, row.size, row.finish].filter(Boolean);

  const tiles: { label: string; value: number; active: boolean }[] = [
    { label: 'Order qty', value: row.quantity, active: false },
    { label: 'Ordered', value: row.orderedQty, active: isOrdered },
    { label: 'Received', value: row.receivedQty, active: !isOrdered },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-[1px]"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accent.ring}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-slate-900">{isOrdered ? 'How many are ordered?' : 'How many are received?'}</h3>
            <p className="truncate text-sm font-medium text-slate-700">#{row.slNo} · {row.item}</p>
            {details.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {details.map((d) => (
                  <span key={d} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{d}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* Current numbers */}
          <div className="grid grid-cols-3 gap-2">
            {tiles.map((t) => (
              <div key={t.label} className={`rounded-xl border px-3 py-2 text-center ${t.active ? accent.tile : 'border-slate-200 bg-slate-50'}`}>
                <p className="text-lg font-bold tabular-nums text-slate-900">{fmtQty(t.value)}</p>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{t.label}</p>
              </div>
            ))}
          </div>

          {/* Input */}
          <div>
            <label htmlFor="qty-input" className="mb-1.5 block text-xs font-semibold text-slate-600">
              {isOrdered ? 'Total ordered so far' : 'Total received so far'}
            </label>
            <div className="flex items-stretch gap-2">
              <button type="button" onClick={() => step(-1)} aria-label="Decrease"
                className="flex w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <Minus className="h-4 w-4" />
              </button>
              <input id="qty-input" type="number" inputMode="decimal" min={min} max={row.quantity} step="any" value={value} autoFocus
                onChange={(e) => { setValue(e.target.value); setErr(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !invalid && !mut.isPending) mut.mutate(); }}
                className={`h-11 w-full rounded-lg border px-3 text-center text-lg font-semibold tabular-nums focus:outline-none focus:ring-2 ${accent.focus} ${invalid && value.trim() !== '' ? 'border-red-300' : 'border-slate-200'}`} />
              <button type="button" onClick={() => step(1)} aria-label="Increase"
                className="flex w-11 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {quickPicks.map((q) => (
                <button key={q.label} type="button" onClick={() => { setValue(String(q.value)); setErr(''); }}
                  className="rounded-full border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-slate-300 hover:bg-slate-50">
                  {q.label}
                </button>
              ))}
            </div>
            {tooHigh && <p className="mt-1.5 text-xs text-red-600">Can’t be more than the order qty ({fmtQty(row.quantity)}).</p>}
            {tooLow && <p className="mt-1.5 text-xs text-red-600">Can’t be less than what is already received ({fmtQty(min)}).</p>}
          </div>

          {/* Preview */}
          {!invalid && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">After saving</span>
                <PurchaseStatusBadge status={nextStatus} />
              </div>
              <PurchaseProgressBar row={{ quantity: row.quantity, orderedQty: nextOrdered, receivedQty: nextReceived }} />
              <p className="mt-1.5 text-xs text-slate-600">
                Ordered <b>{fmtQty(nextOrdered)}</b> · Received <b>{fmtQty(nextReceived)}</b> of {fmtQty(row.quantity)}
                {' · '}Yet to order <b>{fmtQty(Math.max(0, row.quantity - nextOrdered))}</b>
                {' · '}Balance <b>{fmtQty(Math.max(0, row.quantity - nextReceived))}</b>
              </p>
              {raisesOrdered && (
                <p className="mt-1.5 flex items-start gap-1 text-xs text-blue-700">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Ordered qty will also be set to {fmtQty(num)}.
                </p>
              )}
            </div>
          )}

          {err && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
        </div>

        <div className="flex gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
          <button onClick={onClose} className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={() => mut.mutate()} disabled={invalid || mut.isPending || num === current}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${accent.button}`}>
            {mut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Order" and "Receive" buttons — filled when there is something to do, outlined otherwise. */
export function PurchaseRowActions({ row, onOpen }: { row: PurchaseItemRow; onOpen: (mode: QtyMode) => void }) {
  const orderActive = row.yetToOrderQty > 0;
  const receiveActive = row.balanceQty > 0;
  return (
    <>
      <button onClick={() => onOpen('ordered')} title={orderActive ? `${fmtQty(row.yetToOrderQty)} yet to order` : 'Update ordered qty'}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          orderActive ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
        <Truck className="h-3.5 w-3.5" /> Order
      </button>
      <button onClick={() => onOpen('received')} title={receiveActive ? `${fmtQty(row.balanceQty)} still to receive` : 'Update received qty'}
        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
          receiveActive && row.orderedQty > row.receivedQty ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
        <PackageCheck className="h-3.5 w-3.5" /> Receive
      </button>
    </>
  );
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
  const [qtyModal, setQtyModal] = useState<{ row: PurchaseItemRow; mode: QtyMode } | null>(null);
  const [exporting, setExporting] = useState(false);

  const { data: rows = [], isLoading } = useQuery<PurchaseItemRow[]>({
    queryKey: ['purchase-items', projectId],
    queryFn: () => apiClient.get(`/projects/${projectId}/purchase-items`).then((r) => r.data),
  });

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
  const editMin = modal?.mode === 'edit' ? Math.max(modal.row.receivedQty, modal.row.orderedQty) : 0;
  const qtyInvalid = form.quantity.trim() === '' || Number.isNaN(qtyNum) || qtyNum <= 0 || qtyNum < editMin;

  const th = 'px-2 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500';

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5">
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
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {(['pending', 'ordered', 'received'] as const).map((s) => (
            <span key={s} className={`rounded-full border px-2.5 py-0.5 font-medium ${STATUS_STYLE[s]}`}>
              {PURCHASE_ITEM_STATUS_LABELS[s]}: {counts[s]}
            </span>
          ))}
          <span className="ml-auto flex items-center gap-3 text-slate-400">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Received</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-400" /> Ordered</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" /> Yet to order</span>
          </span>
        </div>
      )}

      {isLoading ? (
        <p className="py-6 text-center text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center">
          <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          <p className="text-sm text-slate-400">No purchase items yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className={`${th} text-left`}>S.No</th>
                <th className={`${th} text-left`}>Area</th>
                <th className={`${th} text-left`}>Item name</th>
                <th className={`${th} text-left`}>Brand</th>
                <th className={`${th} text-left`}>Code</th>
                <th className={`${th} text-left`}>Size</th>
                <th className={`${th} text-left`}>Finish</th>
                <th className={`${th} text-right`}>Order qty</th>
                <th className={`${th} text-right`}>Ordered</th>
                <th className={`${th} text-right`}>Received</th>
                <th className={`${th} text-right`}>Balance</th>
                <th className={`${th} text-left`}>Status</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row._id} className="align-top transition-colors hover:bg-slate-50/70">
                  <td className="px-2 py-3 font-mono text-xs text-slate-400">{row.slNo}</td>
                  <td className="px-2 py-3 text-slate-600">{row.area || '—'}</td>
                  <td className="px-2 py-3 font-medium text-slate-800">{row.item}</td>
                  <td className="px-2 py-3 text-slate-600">{row.brand || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{row.code || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{row.size || '—'}</td>
                  <td className="px-2 py-3 text-slate-600">{row.finish || '—'}</td>
                  <td className="px-2 py-3 text-right font-semibold tabular-nums text-slate-800">{fmtQty(row.quantity)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-blue-700">{fmtQty(row.orderedQty)}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-emerald-700">{fmtQty(row.receivedQty)}</td>
                  <td className={`px-2 py-3 text-right font-semibold tabular-nums ${row.balanceQty > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                    {fmtQty(row.balanceQty)}
                  </td>
                  <td className="px-2 py-3">
                    <PurchaseStatusBadge status={row.status} />
                    <PurchaseProgressBar row={row} />
                    {row.status === 'pending' && row.orderedQty > 0 && (
                      <p className="mt-1 text-[11px] text-slate-500">{fmtQty(row.yetToOrderQty)} left to order</p>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      {canManage && <PurchaseRowActions row={row} onOpen={(mode) => setQtyModal({ row, mode })} />}
                      {canAdd && (
                        <button onClick={() => openEdit(row)} title="Edit item" aria-label={`Edit ${row.item}`}
                          className="inline-flex items-center rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canAdd && row.orderedQty === 0 && row.receivedQty === 0 && (
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
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
                    <p className="mt-1 text-xs text-slate-400">At least {fmtQty(editMin)} (already ordered / received)</p>
                  )}
                </div>
              </div>

              {mergeTarget && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
                  Matches existing item <b>#{mergeTarget.slNo}</b> — order qty will go from <b>{fmtQty(mergeTarget.quantity)}</b> to{' '}
                  <b>{fmtQty(mergeTarget.quantity + (qtyInvalid ? 0 : qtyNum))}</b>
                  {mergeTarget.receivedQty > 0 && <> ({fmtQty(mergeTarget.receivedQty)} already received)</>}, and the new quantity will be “Yet to order”.
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

      {qtyModal && <QtyUpdateModal row={qtyModal.row} mode={qtyModal.mode} onClose={() => setQtyModal(null)} />}
    </div>
  );
}
