import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/services/api';
import type { Project } from '@ti/shared';

type ProjectPopulated = Project & {
  client?: { name: string };
  currentStage?: { name: string };
};

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectPopulated[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get<ProjectPopulated[]>('/projects');
      setProjects(res.data);
    } catch {
      // silently handle offline
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }, [loadProjects]);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('projects')}</Text>
      <FlatList
        data={projects}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('noProjects')}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/projects/${item._id}`)}
            accessibilityLabel={`Open project ${item.title}`}
          >
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardSub}>
              {typeof item.client === 'object' && item.client ? item.client.name : ''}
            </Text>
            <View style={styles.progressRow}>
              <View style={styles.progressBg}>
                <View style={[styles.progressFill, { width: `${item.progressPct}%` }]} />
              </View>
              <Text style={styles.progressPct}>{item.progressPct}%</Text>
            </View>
            <Text style={styles.stage}>
              {typeof item.currentStage === 'object' && item.currentStage
                ? item.currentStage.name
                : ''}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingTop: 56 },
  heading: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  progressBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#2563EB', borderRadius: 4 },
  progressPct: { fontSize: 12, color: '#6B7280', width: 34, textAlign: 'right' },
  stage: { fontSize: 12, color: '#2563EB', marginTop: 6 },
});
