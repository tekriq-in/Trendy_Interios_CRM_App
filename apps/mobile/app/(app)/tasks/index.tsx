import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../../../src/services/api';
import { SkeletonTaskRow } from '../../../src/components/Skeleton';
import type { Project, Task } from '@ti/shared';

type FlatTask = Task & { projectTitle: string };
type ProjectItem = { _id: string; title: string };

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

  // Create task modal
  const [showModal, setShowModal] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

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

  const openCreateModal = useCallback(async () => {
    setTaskTitle('');
    setDueDate('');
    setSelectedProject(null);
    setCreateError('');
    setShowModal(true);
    try {
      const res = await api.get<ProjectItem[]>('/projects');
      setProjects(res.data);
    } catch {
      setProjects([]);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!taskTitle.trim()) { setCreateError('Task title is required.'); return; }
    if (!selectedProject) { setCreateError('Please select a project.'); return; }
    setCreating(true); setCreateError('');
    try {
      await api.post(`/projects/${selectedProject._id}/tasks`, {
        title: taskTitle.trim(),
        dueDate: dueDate || undefined,
      });
      setShowModal(false);
      await loadTasks();
    } catch {
      setCreateError('Failed to create task. Please try again.');
    } finally {
      setCreating(false);
    }
  }, [taskTitle, selectedProject, dueDate, loadTasks]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.heading}>My Tasks</Text>
        <View style={{ gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <SkeletonTaskRow key={i} />)}
        </View>
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
        contentContainerStyle={{ paddingBottom: 100 }}
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

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={openCreateModal}
        accessibilityLabel="Create new task"
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      {/* Create Task Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Task</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Task title *</Text>
            <TextInput
              style={styles.input}
              value={taskTitle}
              onChangeText={(v) => { setTaskTitle(v); if (createError) setCreateError(''); }}
              placeholder="What needs to be done?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Project *</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerBtn]}
              onPress={() => setShowProjectPicker(true)}
              accessibilityLabel="Select project"
            >
              <Text style={selectedProject ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedProject ? selectedProject.title : 'Select a project…'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Due date (optional)</Text>
            <TextInput
              style={styles.input}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#94A3B8"
              keyboardType="numbers-and-punctuation"
            />

            {createError ? <Text style={styles.error}>{createError}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, creating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={creating}
              accessibilityLabel="Create task"
            >
              <Text style={styles.submitBtnText}>
                {creating ? 'Creating…' : 'Create Task'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Project Picker Modal */}
      <Modal
        visible={showProjectPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProjectPicker(false)}
      >
        <View style={styles.pickerModal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Project</Text>
            <TouchableOpacity onPress={() => setShowProjectPicker(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
          {projects.length === 0 ? (
            <Text style={styles.empty}>No projects available.</Text>
          ) : (
            <FlatList
              data={projects}
              keyExtractor={(p) => p._id}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.projectPickerItem,
                    selectedProject?._id === item._id && styles.projectPickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedProject(item);
                    setShowProjectPicker(false);
                    if (createError) setCreateError('');
                  }}
                  accessibilityLabel={`Select ${item.title}`}
                >
                  <Text style={[
                    styles.projectPickerText,
                    selectedProject?._id === item._id && styles.projectPickerTextActive,
                  ]}>
                    {item.title}
                  </Text>
                  {selectedProject?._id === item._id && (
                    <Text style={{ color: '#4F46E5', fontSize: 18 }}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 56 },
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
  // FAB
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', marginTop: -2 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20 },
  pickerModal: { flex: 1, backgroundColor: '#fff', padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A' },
  closeBtn: { padding: 8, minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 18, color: '#64748B' },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 48,
  },
  pickerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerText: { fontSize: 15, color: '#0F172A', flex: 1 },
  pickerPlaceholder: { fontSize: 15, color: '#94A3B8', flex: 1 },
  pickerChevron: { fontSize: 22, color: '#94A3B8', marginLeft: 8 },
  error: { color: '#DC2626', fontSize: 13, marginTop: 10 },
  submitBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
    minHeight: 56,
    justifyContent: 'center',
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  projectPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    minHeight: 56,
  },
  projectPickerItemActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  projectPickerText: { fontSize: 15, color: '#0F172A', flex: 1, fontWeight: '500' },
  projectPickerTextActive: { color: '#4F46E5', fontWeight: '700' },
});
