import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { api } from '../../../src/services/api';
import type { Project, Task } from '@ti/shared';

type FlatTask = Task & { projectTitle: string };

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  in_progress: '#3B82F6',
  done: '#10B981',
  blocked: '#EF4444',
};

export default function MyTasksScreen() {
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const projectsRes = await api.get<(Project & { _id: string; title: string })[]>('/projects');
      const allTasks: FlatTask[] = [];
      await Promise.all(
        projectsRes.data.map(async (project) => {
          try {
            const tasksRes = await api.get<Task[]>(`/projects/${project._id}/tasks`);
            tasksRes.data.forEach((t) =>
              allTasks.push({ ...t, projectTitle: project.title }),
            );
          } catch {
            // project may have no tasks
          }
        }),
      );
      allTasks.sort((a, b) => {
        const order = ['blocked', 'in_progress', 'pending', 'done'];
        return order.indexOf(a.status) - order.indexOf(b.status);
      });
      setTasks(allTasks);
    } catch {
      // offline — keep stale data
    }
  }, []);

  useEffect(() => {
    loadTasks().finally(() => setLoading(false));
  }, [loadTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, [loadTasks]);

  const markDone = useCallback(async (taskId: string) => {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'done' });
      setTasks((prev) => prev.map((t) => (t._id === taskId ? { ...t, status: 'done' } : t)));
    } catch {
      // silently handle
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4F46E5" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>My Tasks</Text>
      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<Text style={styles.empty}>No tasks assigned.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={[styles.dot, { backgroundColor: STATUS_COLORS[item.status] ?? '#9CA3AF' }]} />
              <View style={styles.cardBody}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.projectLabel}>{item.projectTitle}</Text>
                {item.dueDate && (
                  <Text style={styles.due}>
                    Due {new Date(item.dueDate).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}
                  </Text>
                )}
              </View>
              <View style={[styles.badge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
                <Text style={[styles.badgeText, { color: STATUS_COLORS[item.status] }]}>
                  {item.status.replace('_', ' ')}
                </Text>
              </View>
            </View>
            {item.status !== 'done' && (
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => markDone(item._id)}
                accessibilityLabel="Mark task as done"
              >
                <Text style={styles.doneBtnText}>Mark Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 56 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  heading: { fontSize: 24, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 48, fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  cardBody: { flex: 1 },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  projectLabel: { fontSize: 12, color: '#64748B', marginTop: 2 },
  due: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  doneBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  doneBtnText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
});
