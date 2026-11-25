import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@ti/shared';
import { api, describeApiError } from '../../../src/services/api';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { Toast, useToast } from '../../../src/components/Toast';
import { Chip, EmptyState, ErrorState, ScreenHeader } from '../../../src/components/ui';
import { HandoverItem, type HandoverRow } from '../../../src/components/project/HandoverItem';
import { RejectHandoverSheet } from '../../../src/components/project/RejectHandoverSheet';
import { colors, spacing } from '../../../src/theme';

type Filter = 'action' | 'all';

/**
 * Handovers across the user's projects. The point of this screen is the
 * "needs my action" view: a team lead sees every handover waiting for their
 * confirmation or acceptance without opening each project.
 */
export default function HandoverInboxScreen() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const canConfirm = can(PERMISSIONS.HANDOVERS_CONFIRM_FROM);
  const canAccept = can(PERMISSIONS.HANDOVERS_ACCEPT_TO);

  const [items, setItems] = useState<HandoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<HandoverRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [proj, hov] = await Promise.all([
        api.get<{ _id: string }[]>('/projects'),
        api.get<HandoverRow[]>('/handovers'),
      ]);
      // GET /handovers is not yet limited to the user's projects on the server,
      // so keep only the ones from projects this user is allowed to see.
      const mine = new Set(proj.data.map((p) => p._id));
      setItems(hov.data.filter((h) => !!h.project?._id && mine.has(h.project._id)));
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const needsMyAction = useCallback(
    (h: HandoverRow) => (h.status === 'draft' && canConfirm) || (h.status === 'confirmed' && canAccept),
    [canConfirm, canAccept],
  );

  const actionable = useMemo(() => items.filter(needsMyAction), [items, needsMyAction]);
  // Default to "needs my action" for leads, and to everything for people who cannot act.
  const active: Filter = filter ?? (canConfirm || canAccept ? 'action' : 'all');
  const visible = active === 'action' ? actionable : items;

  async function act(h: HandoverRow, action: 'confirm' | 'accept') {
    setBusyId(h._id);
    try {
      await api.patch(`/handovers/${h._id}/${action}`);
      void load();
    } catch (err) {
      showToast(describeApiError(err, t('common.checkConnection')), 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <View style={styles.root}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader
        title={t('handoverInbox.title')}
        subtitle={actionable.length > 0 ? `${actionable.length} ${t('handoverInbox.needsAction').toLowerCase()}` : undefined}
        back
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
          keyExtractor={(h) => h._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            canConfirm || canAccept ? (
              <View style={styles.filters}>
                <Chip
                  label={`${t('handoverInbox.needsAction')} (${actionable.length})`}
                  selected={active === 'action'}
                  onPress={() => setFilter('action')}
                />
                <Chip label={`${t('handoverInbox.all')} (${items.length})`} selected={active === 'all'} onPress={() => setFilter('all')} />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon="swap-horizontal-outline"
              title={active === 'action' ? t('handoverInbox.nothingToDo') : t('handoverInbox.empty')}
              message={active === 'action' ? undefined : t('handoverInbox.emptyMessage')}
            />
          }
          renderItem={({ item }) => (
            <HandoverItem
              handover={item}
              showProject
              canConfirm={canConfirm}
              canAccept={canAccept}
              busy={busyId === item._id}
              onConfirm={() => act(item, 'confirm')}
              onAccept={() => act(item, 'accept')}
              onReject={() => setRejecting(item)}
            />
          )}
        />
      )}

      <RejectHandoverSheet handover={rejecting} onClose={() => setRejecting(null)} onRejected={() => void load()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, paddingBottom: 40 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
});
