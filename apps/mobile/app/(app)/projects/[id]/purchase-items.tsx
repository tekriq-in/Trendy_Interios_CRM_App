import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS, type PurchaseItemStatus } from '@ti/shared';
import { api } from '../../../../src/services/api';
import { usePermissions } from '../../../../src/hooks/usePermissions';
import { Toast, useToast } from '../../../../src/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, HeaderIconButton, ProgressBar, ScreenHeader } from '../../../../src/components/ui';
import { AddPurchaseItemSheet } from '../../../../src/components/purchase/AddPurchaseItemSheet';
import { QuantitySheet } from '../../../../src/components/purchase/QuantitySheet';
import { fmtQty, type PurchaseItem } from '../../../../src/components/purchase/purchase-shared';
import { colors, font, radius, spacing, type Tone } from '../../../../src/theme';

type Filter = 'all' | PurchaseItemStatus;

const STATUS_TONE: Record<PurchaseItemStatus, Tone> = { pending: 'warning', ordered: 'info', received: 'success' };
const STATUS_KEY: Record<PurchaseItemStatus, string> = {
  pending: 'purchase.statusPending',
  ordered: 'purchase.statusOrdered',
  received: 'purchase.statusReceived',
};

export default function PurchaseItemsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [qty, setQty] = useState<{ item: PurchaseItem; mode: 'ordered' | 'received' } | null>(null);

  const canAdd = can(PERMISSIONS.PURCHASE_ITEMS_ADD);
  const canManage = can(PERMISSIONS.PURCHASE_ITEMS_MANAGE);

  const load = useCallback(async () => {
    try {
      const res = await api.get<PurchaseItem[]>(`/projects/${id}/purchase-items`);
      setItems(res.data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  function replaceItem(updated: PurchaseItem) {
    setItems((prev) => {
      const exists = prev.some((i) => i._id === updated._id);
      const next = exists ? prev.map((i) => (i._id === updated._id ? updated : i)) : [...prev, updated];
      return next.sort((a, b) => a.slNo - b.slNo);
    });
  }

  const count = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      ordered: items.filter((i) => i.status === 'ordered').length,
      received: items.filter((i) => i.status === 'received').length,
    }),
    [items],
  );
  const visible = filter === 'all' ? items : items.filter((i) => i.status === filter);

  return (
    <View style={styles.root}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader
        title={t('purchase.title')}
        subtitle={items.length ? `${count.received}/${items.length} ${t('purchase.statusReceived').toLowerCase()}` : undefined}
        back
        right={canAdd ? <HeaderIconButton icon="add" label={t('purchase.add')} onPress={() => setShowAdd(true)} /> : undefined}
      />

      {loading ? null : failed && items.length === 0 ? (
        <ErrorState
          title={t('common.couldNotLoad')}
          message={`${t('common.checkConnection')}\n${t('common.serverWaking')}`}
          retryLabel={t('common.retry')}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => i._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            items.length > 0 ? (
              <View style={styles.filters}>
                <Chip label={`${t('purchase.all')} (${count.all})`} selected={filter === 'all'} onPress={() => setFilter('all')} />
                <Chip label={`${t('purchase.statusPending')} (${count.pending})`} selected={filter === 'pending'} onPress={() => setFilter('pending')} />
                <Chip label={`${t('purchase.statusOrdered')} (${count.ordered})`} selected={filter === 'ordered'} onPress={() => setFilter('ordered')} />
                <Chip label={`${t('purchase.statusReceived')} (${count.received})`} selected={filter === 'received'} onPress={() => setFilter('received')} />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="cart-outline"
              title={t('purchase.empty')}
              message={canAdd ? t('purchase.emptyAdd') : undefined}
              actionLabel={canAdd ? t('purchase.add') : undefined}
              onAction={canAdd ? () => setShowAdd(true) : undefined}
            />
          }
          renderItem={({ item }) => {
            const details = [item.area, item.brand, item.code, item.size, item.finish].filter(Boolean).join(' · ');
            const orderActive = item.yetToOrderQty > 0;
            const receiveActive = item.orderedQty > item.receivedQty;
            return (
              <Card style={styles.card}>
                <View style={styles.top}>
                  <Text style={styles.name}>#{item.slNo}  {item.item}</Text>
                  <Badge label={t(STATUS_KEY[item.status])} tone={STATUS_TONE[item.status]} />
                </View>
                {details ? <Text style={styles.details}>{details}</Text> : null}

                <View style={styles.qtyRow}>
                  <Qty label={t('purchase.qOrder')} value={fmtQty(item.quantity)} />
                  <Qty label={t('purchase.qOrdered')} value={fmtQty(item.orderedQty)} color={colors.info} />
                  <Qty label={t('purchase.qReceived')} value={fmtQty(item.receivedQty)} color={colors.success} />
                  <Qty label={t('purchase.qBalance')} value={fmtQty(item.balanceQty)} color={item.balanceQty > 0 ? colors.warning : colors.textSubtle} />
                </View>
                <ProgressBar value={item.quantity > 0 ? (item.receivedQty / item.quantity) * 100 : 0} tone="success" showLabel={false} />

                {canManage ? (
                  <View style={styles.actions}>
                    <View style={styles.flex}>
                      <Button
                        label={orderActive ? t('purchase.orderLeft', { n: fmtQty(item.yetToOrderQty) }) : t('purchase.orderBtn')}
                        icon="cart"
                        variant={orderActive ? 'primary' : 'secondary'}
                        onPress={() => setQty({ item, mode: 'ordered' })}
                      />
                    </View>
                    <View style={styles.flex}>
                      <Button
                        label={t('purchase.receiveBtn')}
                        icon="checkmark-done"
                        variant={receiveActive ? 'primary' : 'secondary'}
                        onPress={() => setQty({ item, mode: 'received' })}
                      />
                    </View>
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}

      <AddPurchaseItemSheet
        visible={showAdd}
        projectId={id}
        items={items}
        onClose={() => setShowAdd(false)}
        onSaved={(item, merged) => {
          replaceItem(item);
          showToast(merged ? t('purchase.merged', { item: item.item, qty: fmtQty(item.quantity) }) : t('purchase.added'), 'success');
        }}
      />
      <QuantitySheet
        item={qty?.item ?? null}
        mode={qty?.mode ?? 'ordered'}
        onClose={() => setQty(null)}
        onSaved={(updated) => {
          replaceItem(updated);
          showToast(t('purchase.saved'), 'success');
        }}
      />
    </View>
  );
}

function Qty({ label, value, color = colors.text }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.qty}>
      <Text style={[styles.qtyNum, { color }]}>{value}</Text>
      <Text style={styles.qtyLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  name: { ...font.h3, flex: 1 },
  details: { ...font.caption, marginTop: 4 },
  qtyRow: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.md },
  qty: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, paddingVertical: 10, alignItems: 'center' },
  qtyNum: { fontSize: 20, fontWeight: '800' },
  qtyLabel: { ...font.caption, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
