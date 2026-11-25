import { FlatList, RefreshControl, StyleSheet, Text, TextInput, View, ScrollView } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { PERMISSIONS } from '@ti/shared';
import { api } from '../../../src/services/api';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { SkeletonProjectCard } from '../../../src/components/Skeleton';
import { ClientOnboardingModal } from '../../../src/components/ClientOnboardingModal';
import {
  Badge,
  Card,
  Chip,
  EmptyState,
  ErrorState,
  HeaderIconButton,
  ProgressBar,
  ScreenHeader,
} from '../../../src/components/ui';
import { colors, font, radius, size, spacing } from '../../../src/theme';

interface ProjectRow {
  _id: string;
  title: string;
  progressPct: number;
  client?: { name?: string } | string;
  currentStage?: { _id?: string; name?: string } | string;
  targetDate?: string;
}

const clientName = (p: ProjectRow) => (typeof p.client === 'object' ? (p.client?.name ?? '') : '');
const stageName = (p: ProjectRow) => (typeof p.currentStage === 'object' ? (p.currentStage?.name ?? '') : '');

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const { can } = usePermissions();

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get<ProjectRow[]>('/projects');
      setProjects(res.data);
      setFailed(false);
    } catch {
      // Keep any projects we already have; only show the error state when there is nothing to show.
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

  const stages = useMemo(
    () => Array.from(new Set(projects.map(stageName).filter(Boolean))),
    [projects],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((p) => {
      if (stage && stageName(p) !== stage) return false;
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || clientName(p).toLowerCase().includes(q);
    });
  }, [projects, query, stage]);

  const canCreateClient = can(PERMISSIONS.CLIENTS_CREATE);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('projects.title')}
        subtitle={projects.length ? `${visible.length} / ${projects.length}` : undefined}
        right={
          canCreateClient ? (
            <HeaderIconButton icon="person-add-outline" label={t('projects.newClient')} onPress={() => setShowOnboarding(true)} />
          ) : undefined
        }
      />

      {loading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonProjectCard key={i} />
          ))}
        </View>
      ) : failed && projects.length === 0 ? (
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
          keyExtractor={(item) => item._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View>
              <View style={styles.search}>
                <Ionicons name="search" size={20} color={colors.textSubtle} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('projects.searchPlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  style={styles.searchInput}
                  accessibilityLabel={t('common.search')}
                  returnKeyType="search"
                  autoCorrect={false}
                />
                {query ? (
                  <Ionicons name="close-circle" size={22} color={colors.textSubtle} onPress={() => setQuery('')} accessibilityLabel={t('common.cancel')} />
                ) : null}
              </View>
              {stages.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  <Chip label={t('projects.allStages')} selected={stage === null} onPress={() => setStage(null)} />
                  {stages.map((s) => (
                    <Chip key={s} label={s} selected={stage === s} onPress={() => setStage(stage === s ? null : s)} />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            projects.length === 0 ? (
              <EmptyState icon="albums-outline" title={t('projects.empty')} message={t('projects.emptyMessage')} />
            ) : (
              <EmptyState
                icon="search-outline"
                title={t('projects.noResults')}
                message={t('projects.noResultsMessage')}
                actionLabel={t('common.all')}
                onAction={() => {
                  setQuery('');
                  setStage(null);
                }}
              />
            )
          }
          renderItem={({ item }) => (
            <Card
              style={styles.card}
              onPress={() => router.push(`/(app)/projects/${item._id}`)}
              accessibilityLabel={item.title}
            >
              <View style={styles.cardTop}>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle} numberOfLines={2}>
                    {item.title}
                  </Text>
                  {clientName(item) ? (
                    <Text style={styles.cardSub} numberOfLines={1}>
                      {clientName(item)}
                    </Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={22} color={colors.textSubtle} />
              </View>
              <View style={{ height: 12 }} />
              <ProgressBar value={item.progressPct} />
              {stageName(item) ? (
                <View style={{ marginTop: 10 }}>
                  <Badge label={stageName(item)} tone="primary" />
                </View>
              ) : null}
            </Card>
          )}
        />
      )}

      <ClientOnboardingModal
        visible={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onCreated={() => void load()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  skeletons: { padding: spacing.lg, gap: 10 },
  list: { padding: spacing.lg, paddingBottom: 32 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.control,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, minHeight: size.control },
  chips: { gap: 8, paddingVertical: spacing.md },
  card: { marginBottom: spacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { ...font.h3 },
  cardSub: { ...font.caption, marginTop: 2 },
});
