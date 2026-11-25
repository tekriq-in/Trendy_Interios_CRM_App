import { Alert, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@ti/shared';
import { api, describeApiError } from '../../../src/services/api';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { Toast, useToast } from '../../../src/components/Toast';
import { Badge, Button, Card, Chip, EmptyState, ErrorState, HeaderIconButton, ScreenHeader } from '../../../src/components/ui';
import { RaiseBlockerSheet } from '../../../src/components/project/RaiseBlockerSheet';
import { colors, font, spacing, type Tone } from '../../../src/theme';

interface BlockerRow {
  _id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  project?: { _id?: string; title?: string };
  raisedBy?: { name?: string };
  createdAt?: string;
}
type Filter = 'open' | 'sla_triggered' | 'resolved' | 'all';

const STATUS_TONE: Record<string, Tone> = { open: 'warning', sla_triggered: 'danger', resolved: 'success' };
const STATUS_KEY: Record<string, string> = {
  open: 'blockers.statusOpen',
  sla_triggered: 'blockers.statusEscalated',
  resolved: 'blockers.statusResolved',
};

export default function BlockersScreen() {
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [items, setItems] = useState<BlockerRow[]>([]);
  const [projects, setProjects] = useState<{ _id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showRaise, setShowRaise] = useState(false);

  const load = useCallback(async () => {
    try {
      const [blk, proj] = await Promise.all([
        api.get<BlockerRow[]>('/blockers'),
        api.get<{ _id: string; title: string }[]>('/projects'),
      ]);
      setItems(blk.data);
      setProjects(proj.data);
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

  const count = useMemo(
    () => ({
      open: items.filter((b) => b.status === 'open').length,
      sla_triggered: items.filter((b) => b.status === 'sla_triggered').length,
      resolved: items.filter((b) => b.status === 'resolved').length,
      all: items.length,
    }),
    [items],
  );
  const visible = filter === 'all' ? items : items.filter((b) => b.status === filter);

  async function act(b: BlockerRow, action: 'resolve' | 'trigger-sla') {
    setBusyId(b._id);
    try {
      await api.patch(`/blockers/${b._id}/${action}`);
      void load();
    } catch (err) {
      showToast(describeApiError(err, t('common.checkConnection')), 'error');
    } finally {
      setBusyId(null);
    }
  }

  // Escalation is a deliberate, manual decision (SOW), so always confirm it.
  function confirmEscalate(b: BlockerRow) {
    Alert.alert(t('blockers.triggerTitle'), t('blockers.triggerMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('blockers.triggerSla'), style: 'destructive', onPress: () => void act(b, 'trigger-sla') },
    ]);
  }

  const fmt = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' })
      : '';

  return (
    <View style={styles.root}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader
        title={t('blockers.title')}
        subtitle={count.open > 0 ? `${count.open} ${t('blockers.open').toLowerCase()}` : undefined}
        back
        right={can(PERMISSIONS.BLOCKERS_RAISE) && projects.length > 0 ? <HeaderIconButton icon="add" label={t('blocker.raise')} onPress={() => setShowRaise(true)} /> : undefined}
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
          keyExtractor={(b) => b._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.filters}>
              <Chip label={`${t('blockers.open')} (${count.open})`} selected={filter === 'open'} onPress={() => setFilter('open')} />
              <Chip label={`${t('blockers.escalated')} (${count.sla_triggered})`} selected={filter === 'sla_triggered'} onPress={() => setFilter('sla_triggered')} />
              <Chip label={`${t('blockers.resolved')} (${count.resolved})`} selected={filter === 'resolved'} onPress={() => setFilter('resolved')} />
              <Chip label={t('blockers.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
            </View>
          }
          ListEmptyComponent={<EmptyState icon="checkmark-circle-outline" title={t('blockers.empty')} message={t('blockers.emptyMessage')} />}
          renderItem={({ item }) => (
            <Card style={styles.card}>
              {item.project?.title ? <Text style={styles.project} numberOfLines={1}>{item.project.title}</Text> : null}
              <View style={styles.top}>
                <Text style={styles.title}>{item.title}</Text>
              </View>
              <View style={styles.badges}>
                <Badge label={t(STATUS_KEY[item.status] ?? 'blockers.statusOpen')} tone={STATUS_TONE[item.status] ?? 'neutral'} />
                <Badge label={item.type === 'client_side' ? t('blocker.clientSide') : t('blocker.internal')} tone={item.type === 'client_side' ? 'info' : 'neutral'} />
              </View>
              {item.description ? <Text style={styles.desc} numberOfLines={3}>{item.description}</Text> : null}
              <Text style={styles.meta}>
                {[item.raisedBy?.name ? t('blockers.raisedBy', { name: item.raisedBy.name }) : null, fmt(item.createdAt)].filter(Boolean).join('  ·  ')}
              </Text>

              {item.status !== 'resolved' && (can(PERMISSIONS.BLOCKERS_RESOLVE) || (item.status === 'open' && can(PERMISSIONS.BLOCKERS_TRIGGER_SLA))) ? (
                <View style={styles.actions}>
                  {item.status === 'open' && can(PERMISSIONS.BLOCKERS_TRIGGER_SLA) ? (
                    <View style={styles.flex}>
                      <Button label={t('blockers.triggerSla')} variant="secondary" icon="alarm" onPress={() => confirmEscalate(item)} disabled={busyId === item._id} />
                    </View>
                  ) : null}
                  {can(PERMISSIONS.BLOCKERS_RESOLVE) ? (
                    <View style={styles.flex}>
                      <Button label={t('blockers.resolve')} icon="checkmark" onPress={() => act(item, 'resolve')} loading={busyId === item._id} />
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Card>
          )}
        />
      )}

      <RaiseBlockerSheet
        visible={showRaise}
        onClose={() => setShowRaise(false)}
        projects={projects}
        onRaised={() => {
          showToast(t('blocker.raised'), 'success');
          void load();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  card: { marginBottom: spacing.md },
  project: { color: colors.primary, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  top: { flexDirection: 'row' },
  title: { ...font.h3, flex: 1 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  desc: { ...font.body, color: colors.textMuted, marginTop: spacing.sm },
  meta: { ...font.caption, marginTop: spacing.sm },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
