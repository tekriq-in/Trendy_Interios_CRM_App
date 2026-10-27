import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, ScrollView, TextInput, Modal,
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { api } from '../../../../src/services/api';

interface PurchaseItem {
  _id: string;
  item: string;
  description?: string;
  quantity: number;
  unit?: string;
  supplier?: string;
  status: 'pending' | 'ordered' | 'received';
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#FEF3C7', text: '#92400E' },
  ordered: { bg: '#DBEAFE', text: '#1E40AF' },
  received: { bg: '#D1FAE5', text: '#065F46' },
};

const STATUS_CYCLE: Record<string, string> = {
  pending: 'ordered',
  ordered: 'received',
  received: 'pending',
};

export default function PurchaseItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ item: '', description: '', quantity: '1', unit: '', supplier: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<PurchaseItem[]>(`/projects/${id}/purchase-items`);
      setItems(res.data);
    } catch {
      // offline — show stale data
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function cycleStatus(item: PurchaseItem) {
    const next = STATUS_CYCLE[item.status];
    try {
      await api.patch(`/purchase-items/${item._id}`, { status: next });
      setItems((prev) => prev.map((i) => i._id === item._id ? { ...i, status: next as PurchaseItem['status'] } : i));
    } catch {
      Alert.alert('Error', 'Failed to update status.');
    }
  }

  async function addItem() {
    if (!form.item.trim()) { Alert.alert('Required', 'Item name is required.'); return; }
    setSaving(true);
    try {
      const res = await api.post<PurchaseItem>(`/projects/${id}/purchase-items`, {
        item: form.item.trim(),
        description: form.description || undefined,
        quantity: Number(form.quantity) || 1,
        unit: form.unit || undefined,
        supplier: form.supplier || undefined,
      });
      setItems((prev) => [...prev, res.data]);
      setShowModal(false);
      setForm({ item: '', description: '', quantity: '1', unit: '', supplier: '' });
    } catch {
      Alert.alert('Error', 'Failed to add item.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#4F46E5" size="large" /></View>;

  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const orderedCount = items.filter((i) => i.status === 'ordered').length;
  const receivedCount = items.filter((i) => i.status === 'received').length;

  return (
    <View style={s.container}>
      {/* Summary */}
      <View style={s.summaryRow}>
        {[
          { label: 'Pending', count: pendingCount, color: '#F59E0B' },
          { label: 'Ordered', count: orderedCount, color: '#3B82F6' },
          { label: 'Received', count: receivedCount, color: '#10B981' },
        ].map((stat) => (
          <View key={stat.label} style={s.statCard}>
            <Text style={[s.statCount, { color: stat.color }]}>{stat.count}</Text>
            <Text style={s.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {items.length === 0 && (
          <Text style={s.empty}>No purchase items yet. Tap + to add one.</Text>
        )}
        {items.map((item) => {
          const col = STATUS_COLORS[item.status];
          return (
            <View key={item._id} style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{item.item}</Text>
                {item.description ? <Text style={s.itemSub}>{item.description}</Text> : null}
                <Text style={s.itemMeta}>
                  Qty: {item.quantity}{item.unit ? ` ${item.unit}` : ''}{item.supplier ? `  ·  ${item.supplier}` : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[s.statusPill, { backgroundColor: col.bg }]}
                onPress={() => cycleStatus(item)}
                accessibilityLabel={`Status: ${item.status}. Tap to cycle.`}
              >
                <Text style={[s.statusText, { color: col.text }]}>{item.status}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity style={s.fab} onPress={() => setShowModal(true)} accessibilityLabel="Add purchase item">
        <Text style={s.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Add Purchase Item</Text>
            {[
              { key: 'item', label: 'Item name *', placeholder: 'e.g. Laminate sheets' },
              { key: 'description', label: 'Description', placeholder: 'Optional details' },
              { key: 'quantity', label: 'Quantity', placeholder: '1', keyboard: 'numeric' as const },
              { key: 'unit', label: 'Unit', placeholder: 'pcs, sqft…' },
              { key: 'supplier', label: 'Supplier', placeholder: 'Vendor name' },
            ].map((field) => (
              <View key={field.key} style={s.fieldRow}>
                <Text style={s.fieldLabel}>{field.label}</Text>
                <TextInput
                  style={s.input}
                  value={form[field.key as keyof typeof form]}
                  onChangeText={(v) => setForm((p) => ({ ...p, [field.key]: v }))}
                  placeholder={field.placeholder}
                  placeholderTextColor="#94A3B8"
                  keyboardType={field.keyboard}
                />
              </View>
            ))}
            <View style={s.sheetBtns}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setShowModal(false)}>
                <Text style={s.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, saving && { opacity: 0.6 }]} onPress={addItem} disabled={saving}>
                <Text style={s.saveText}>{saving ? 'Adding…' : 'Add Item'}</Text>
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
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  itemSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  itemMeta: { fontSize: 11, color: '#94A3B8', marginTop: 3 },
  statusPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', shadowColor: '#4F46E5', shadowOpacity: 0.4, shadowOffset: { width: 0, height: 4 }, shadowRadius: 8, elevation: 6 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  fieldRow: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC' },
  sheetBtns: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  cancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  saveBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
