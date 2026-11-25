import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { api } from '../../../src/services/api';
import type { RootState } from '../../../src/store';
import { Badge, Card, ProgressBar, ScreenHeader } from '../../../src/components/ui';
import { colors, font, radius, spacing, type Tone, toneColors } from '../../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ProjectRow {
  _id: string;
  title: string;
  progressPct: number;
  client?: { name?: string } | string;
  currentStage?: { name?: string } | string;
}
interface BlockerRow {
  _id: string;
  status: string;
}
interface HandoverRow {
  _id: string;
  status: string;
  project?: { _id?: string } | string;
  projectArr?: { _id: string }[];
}

const idOf = (v: unknown): string =>
  typeof v === 'string' ? v : v && typeof v === 'object' && '_id' in v ? String((v as { _id: unknown })._id) : '';

export default function HomeScreen() {
  const { t } = useTranslation();
  const user = useSelector((s: RootState) => s.auth.user);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [openBlockers, setOpenBlockers] = useState(0);
  const [waitingHandovers, setWaitingHandovers] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [proj, blk, hov] = await Promise.all([
        api.get<ProjectRow[]>('/projects'),
        api.get<BlockerRow[]>('/blockers'),
        api.get<HandoverRow[]>('/handovers'),
      ]);
      setProjects(proj.data);
      setOpenBlockers(blk.data.filter((b) => b.status !== 'resolved').length);

      // GET /handovers is not yet scoped to the user's projects on the server,
      // so only count the ones that belong to projects this user can see.
      const mine = new Set(proj.data.map((p) => p._id));
      setWaitingHandovers(
        hov.data.filter((h) => {
          const pid = idOf(h.project) || h.projectArr?.[0]?._id || '';
          return mine.has(pid) && (h.status === 'draft' || h.status === 'confirmed');
        }).length,
      );
    } catch {
      // Offline or server asleep: keep showing the last numbers.
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

  const firstName = (user?.name ?? '').split(' ')[0] || '';
  const subtitle = [user?.role, user?.departmentName].filter(Boolean).join(' · ');
  const recent = projects.slice(0, 3);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('home.greeting', { name: firstName })} subtitle={subtitle || undefined} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.section}>{t('home.today')}</Text>
        <View style={styles.tiles}>
          <Tile
            icon="albums"
            tone="primary"
            value={projects.length}
            label={t('home.myProjects')}
            onPress={() => router.push('/(app)/projects')}
          />
          <Tile
            icon="warning"
            tone={openBlockers > 0 ? 'danger' : 'success'}
            value={openBlockers}
            label={t('home.blocked')}
            onPress={() => router.push('/(app)/blockers')}
          />
          <Tile
            icon="swap-horizontal"
            tone={waitingHandovers > 0 ? 'warning' : 'success'}
            value={waitingHandovers}
            label={t('home.handovers')}
            onPress={() => router.push('/(app)/handovers')}
          />
        </View>

        <View style={styles.rowBetween}>
          <Text style={styles.section}>{t('home.myProjects')}</Text>
          {projects.length > 3 ? (
            <Text style={styles.link} onPress={() => router.push('/(app)/projects')} accessibilityRole="link">
              {t('home.viewAll')}
            </Text>
          ) : null}
        </View>

        {recent.length === 0 ? (
          <Card>
            <Text style={styles.empty}>{t('home.nothingToday')}</Text>
          </Card>
        ) : (
          recent.map((p) => (
            <Card
              key={p._id}
              style={styles.project}
              onPress={() => router.push(`/(app)/projects/${p._id}`)}
              accessibilityLabel={p.title}
            >
              <Text style={styles.projectTitle} numberOfLines={1}>
                {p.title}
              </Text>
              <Text style={styles.projectSub} numberOfLines={1}>
                {typeof p.client === 'object' ? p.client?.name : ''}
              </Text>
              <View style={{ height: 10 }} />
              <ProgressBar value={p.progressPct} />
              {typeof p.currentStage === 'object' && p.currentStage?.name ? (
                <View style={{ marginTop: 10 }}>
                  <Badge label={p.currentStage.name} tone="primary" />
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Tile({
  icon,
  tone,
  value,
  label,
  onPress,
}: {
  icon: IconName;
  tone: Tone;
  value: number;
  label: string;
  onPress?: () => void;
}) {
  const c = toneColors[tone];
  return (
    <Card style={styles.tile} onPress={onPress} accessibilityLabel={`${label}: ${value}`}>
      <View style={[styles.tileIcon, { backgroundColor: c.bg }]}>
        <Ionicons name={icon} size={22} color={c.fg} />
      </View>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel} numberOfLines={2}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 32 },
  section: { ...font.h2, marginBottom: spacing.md, marginTop: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  link: { color: colors.primary, fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  tiles: { flexDirection: 'row', gap: spacing.md },
  tile: { flex: 1, padding: spacing.md, alignItems: 'flex-start' },
  tileIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  tileValue: { fontSize: 28, fontWeight: '800', color: colors.text },
  tileLabel: { ...font.caption, marginTop: 2 },
  project: { marginBottom: spacing.md },
  projectTitle: { ...font.h3 },
  projectSub: { ...font.caption, marginTop: 2 },
  empty: { ...font.body, color: colors.textSubtle, textAlign: 'center', paddingVertical: 8 },
});
