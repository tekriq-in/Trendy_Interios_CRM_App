import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, TextInput, Modal,
} from 'react-native';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  PERMISSIONS,
  PURCHASE_ITEM_STATUS_LABELS,
  purchaseItemMatchKey,
  type PurchaseItemStatus,
} from '@ti/shared';
import { api } from '../../../../src/services/api';

interface PurchaseItem {
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

type Form = { area: string; item: string; brand: string; code: string; size: string; finish: string; quantity: string };
const EMPTY_FORM: Form = { area: '', item: '', brand: '', code: '', size: '', finish: '', quantity: '' };

const FIELDS: { key: keyof Form; label: string; placeholder: string; numeric?: boolean }[] = [
  { key: 'area', label: 'Area', placeholder: 'e.g. Kitchen' },
  { key: 'item', label: 'Item name *', placeholder: 'e.g. Hinge' },
  { key: 'brand', label: 'Brand', placeholder: 'e.g. Hettich' },
  { key: 'code', label: 'Code', placeholder: 'e.g. H-35' },
  { key: 'size', label: 'Size', placeholder: 'e.g. 35mm' },
  { key: 'finish', label: 'Finish', placeholder: 'e.g. SS' },
  { key: 'quantity', label: 'Quantity to add *', placeholder: '0', numeric: true },
];

const STATUS_COLORS: Record<PurchaseItemStatus, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  ordered: { bg: '#DBEAFE', text: '#1E40AF' },
  received: { bg: '#D1FAE5', text: '#065F46' },
};

const ERROR_TEXT: Record<string, string> = {
  'purchase_item.received_exceeds_order': 'Received qty cannot be more than the order qty.',
  'auth.insufficient_permissions': 'You do not have permission to do this.',
  'project.not_found': 'You do not have access to this project.',
};

function errorText(err: unknown, fallback: string): string {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  const first = Array.isArray(msg) ? msg[0] : msg;
  return (first && ERROR_TEXT[first]) || fallback;
}

function fmt(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000);
}

export default function PurchaseItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [perms, setPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [receiving, setReceiving] = useState<PurchaseItem | null>(null);
  const [receivedInput, setReceivedInput] = useState('');

  const canAdd = perms.includes(PERMISSIONS.PURCHASE_ITEMS_ADD);
  const canManage = perms.includes(PERMISSIONS.PURCHASE_ITEMS_MANAGE);

  const load = useCallback(async () => {
    try {
      const [itemsRes, permsRes] = await Promise.all([
        api.get<PurchaseItem[]>(`/projects/${id}/purchase-items`),
        api.get<{ permissions: string[] }>('/auth/permissions'),
      ]);
      setItems(itemsRes.data);
      setPerms(permsRes.data.permissions);
    } catch {
      // offline — keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const mergeTarget = useMemo(() => {
    if (!form.item.trim()) return null;
    const key = purchaseItemMatchKey(form);
    return items.find((i) => purchaseItemMatchKey(i) === key) ?? null;
  }, [form, items]);

  function replaceItem(updated: PurchaseItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i._id === updated._id);
      const next = exists ? prev.map((i) => (i._id === updated._id ? updated : i)) : [...prev, updated];
      return next.sort((a, b) => a.slNo - b.slNo);
    });
  }

  async function addItem() {
    const qty = Number(form.quantity);
    if (!form.item.trim()) { Alert.alert('Required', 'Item name is required.'); return; }
    if (!qty || qty <= 0) { Alert.alert('Required', 'Enter a quantity greater than 0.'); return; }
    setSaving(true);
    try {
      const res = await api.post<PurchaseItem & { merged: boolean }>(`/projects/${id}/purchase-items`, {
        area: form.area, item: form.item, brand: form.brand, code: form.code,
        size: form.size, finish: form.finish, quantity: qty,
      });
      replaceItem(res.data);
      setShowAdd(false);
      setForm(EMPTY_FORM);
      if (res.data.merged) Alert.alert('Added', `Order qty for "${res.data.item}" is now ${fmt(res.data.quantity)}.`);
    } catch (err) {
      Alert.alert('Error', errorText(err, 'Failed to add item.'));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(item: PurchaseItem, status: 'pending' | 'ordered') {
    try {
      const res = await api.patch<PurchaseItem>(`/purchase-items/${item._id}/progress`, { status });
      replaceItem(res.data);
    } catch (err) {
      Alert.alert('Error', errorText(err, 'Failed to update status.'));
    }
  }

  async function saveReceived() {
    if (!receiving) return;
    const qty = Number(receivedInput);
    if (receivedInput.trim() === '' || Number.isNaN(qty) || qty < 0 || qty > receiving.quantity) {
      Alert.alert('Invalid', `Enter a number from 0 to ${fmt(receiving.quantity)}.`);
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<PurchaseItem>(`/purchase-items/${receiving._id}/progress`, { receivedQty: qty });
      replaceItem(res.data);
      setReceiving(null);
    } catch (err) {
      Alert.alert('Error', errorText(err, 'Failed to update received qty.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#4F46E5" size="large" /></View>;

  const count = (st: PurchaseItemStatus) => items.filter((i) => i.status === st).length;

  return (
    <View style={s.container}>
      {/* Summary */}
      <View style={s.summaryRow}>
        {(['pending', 'ordered', 'received'] as const).map((st) => (
          <View key={st} style={s.statCard}>
            <Text style={[s.statCount, { color: STATUS_COLORS[st].text }]}>{count(st)}</Text>
            <Text style={s.statLabel}>{PURCHASE_ITEM_STATUS_LABELS[st]}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {items.length === 0 && (
          <Text style={s.empty}>No purchase items yet.{canAdd ? ' Tap + to add one.' : ''}</Text>
        )}
        {items.map((item) => {
          const col = STATUS_COLORS[item.status];
          const details = [item.area, item.brand, item.code, item.size, item.finish].filter(Boolean).join(' · ');
          return (
            <View key={item._id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.itemName}>#{item.slNo}  {item.item}</Text>
                <View style={[s.statusPill, { backgroundColor: col.bg }]}>
                  <Text style={[s.statusText, { color: col.text }]}>{PURCHASE_ITEM_STATUS_LABELS[item.status]}</Text>
                </View>
              </View>
              {details ? <Text style={s.itemSub}>{details}</Text> : null}

              <View style={s.qtyRow}>
                <View style={s.qtyBox}><Text style={s.qtyNum}>{fmt(item.quantity)}</Text><Text style={s.qtyLabel}>Order</Text></View>
                <View style={s.qtyBox}><Text style={[s.qtyNum, { color: '#047857' }]}>{fmt(item.receivedQty)}</Text><Text style={s.qtyLabel}>Received</Text></View>
                <View style={s.qtyBox}><Text style={[s.qtyNum, { color: item.balanceQty > 0 ? '#B45309' : '#94A3B8' }]}>{fmt(item.balanceQty)}</Text><Text style={s.qtyLabel}>Balance</Text></View>
              </View>

              {canManage && (
                <View style={s.actionRow}>
                  {item.status === 'pending' && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#DBEAFE' }]} onPress={() => setStatus(item, 'ordered')}
                      accessibilityLabel={`Mark ${item.item} as ordered`}>
                      <Text style={[s.actionText, { color: '#1E40AF' }]}>Mark ordered</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'ordered' && (
                    <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setStatus(item, 'pending')}
                      accessibilityLabel={`Move ${item.item} back to yet to order`}>
                      <Text style={[s.actionText, { color: '#475569' }]}>Not ordered</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={[s.actionBtn, { backgroundColor: '#D1FAE5' }]}
                    onPress={() => { setReceiving(item); setReceivedInput(String(item.receivedQty)); }}
                    accessibilityLabel={`Record received quantity for ${item.item}`}>
                    <Text style={[s.actionText, { color: '#065F46' }]}>Receive</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {canAdd && (
        <TouchableOpacity style={s.fab} onPress={() => { setForm(EMPTY_FORM); setShowAdd(true); }} accessibilityLabel="Add purchase item">
          <Text style={s.fabText}>+</Text>
        </TouchableOpacity>
      )}

      {/* Add modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={s.overlay}>
          <ScrollView style={s.sheet} contentContainerStyle={{ paddingBottom: 36 }} keyboardShouldPersistTaps="handled">
            <Text style={s.sheetTitle}>Add Purchase Item</Text>
            {FIELDS.map((field) => (
              <View key={field.key} style={s.fieldRow}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field.key]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor="#94A3B8"
                  keyboardType={field.numeric ? 'decimal-pad' : 'default'}
                />
              </View>
            ))}
            {mergeTarget && (
              <Text style={s.mergeHint}>
                Matches item #{mergeTarget.slNo} — order qty will go from {fmt(mergeTarget.quantity)} to{' '}
                {fmt(mergeTarget.quantity + (Number(form.quantity) || 0))} and the balance will be “Yet to order”.
              </Text>
            )}
            <View style={s.sheetBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={addItem} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Saving…' : mergeTarget ? 'Add to existing' : 'Add item'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Receive modal */}
      <Modal visible={!!receiving} animationType="slide" transparent onRequestClose={() => setReceiving(null)}>
        <View style={s.overlay}>
          <View style={[s.sheet, { paddingBottom: 36 }]}>
            <Text style={s.sheetTitle}>Received qty</Text>
            {receiving && (
              <>
                <Text style={s.itemName}>{receiving.item}</Text>
                <Text style={[s.itemSub, { marginBottom: 12 }]}>
                  Order {fmt(receiving.quantity)} · received so far {fmt(receiving.receivedQty)}
                </Text>
                <Text style={s.fieldLabel}>Total received</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    style={[s.input, { flex: 1 }]}
                    value={receivedInput}
                    onChangeText={setReceivedInput}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                  <TouchableOpacity style={s.allBtn} onPress={() => setReceivedInput(String(receiving.quantity))}>
                    <Text style={s.allText}>All ({fmt(receiving.quantity)})</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
            <View style={s.sheetBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setReceiving(null)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={saveReceived} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  summaryRow: { flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 8 },
  statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  statCount: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, color: '#94A3B8', marginTop: 2, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#94A3B8', fontSize: 14, marginTop: 40 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemName: { fontSize: 15, fontWeight: '600', color: '#0F172A', flexShrink: 1 },
  itemSub: { fontSize: 12, color: '#64748B', marginTop: 3 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700' },
  qtyRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  qtyBox: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  qtyNum: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  qtyLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 1 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actionBtn: { flex: 1, minHeight: 48, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 14, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, maxHeight: '90%' },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, minHeight: 48, fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC' },
  mergeHint: { fontSize: 12, color: '#3730A3', backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginBottom: 8 },
  allBtn: { minHeight: 48, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', justifyContent: 'center' },
  allText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  saveBtn: { flex: 2, minHeight: 48, borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
