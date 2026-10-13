import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl,
  Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { api } from '../../../src/services/api';
import { SkeletonBlockerRow } from '../../../src/components/Skeleton';
import type { Blocker } from '@ti/shared';

type BlockerPopulated = Blocker & { project?: { title: string } };
type ProjectItem = { _id: string; title: string };

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  internal: { bg: '#EFF6FF', text: '#2563EB' },
  client_side: { bg: '#FFF7ED', text: '#EA580C' },
};
const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open: { bg: '#FEF2F2', text: '#DC2626' },
  sla_triggered: { bg: '#F5F3FF', text: '#7C3AED' },
  resolved: { bg: '#F0FDF4', text: '#16A34A' },
};

export default function BlockersScreen() {
  const [blockers, setBlockers] = useState<BlockerPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'internal' | 'client_side'>('internal');
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadBlockers = useCallback(async () => {
    try {
      const res = await api.get<BlockerPopulated[]>('/blockers');
      setBlockers(res.data);
    } catch {
      // offline
    }
  }, []);

  useEffect(() => {
    loadBlockers().finally(() => setLoading(false));
  }, [loadBlockers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadBlockers();
    setRefreshing(false);
  }, [loadBlockers]);

  const openModal = useCallback(async () => {
    setTitle('');
    setDescription('');
    setType('internal');
    setSelectedProject(null);
    setFormError('');
    setModalVisible(true);
    try {
      const res = await api.get<ProjectItem[]>('/projects');
      setProjects(res.data);
    } catch {
      setProjects([]);
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) { setFormError('Title is required.'); return; }
    if (!selectedProject) { setFormError('Please select a project.'); return; }
    setSubmitting(true);
    setFormError('');
    try {
      await api.post('/blockers', {
        title: title.trim(),
        description: description.trim(),
        type,
        projectId: selectedProject._id,
      });
      setModalVisible(false);
      await loadBlockers();
    } catch {
      setFormError('Failed to raise blocker. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, type, selectedProject, loadBlockers]);

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>Blockers</Text>
        </View>
        <View style={{ gap: 8 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonBlockerRow key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Blockers</Text>
        <TouchableOpacity
          style={styles.raiseBtn}
          onPress={openModal}
          accessibilityLabel="Raise a new blocker"
        >
          <Text style={styles.raiseBtnText}>+ Raise</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={blockers}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListEmptyComponent={<Text style={styles.empty}>No blockers found.</Text>}
        renderItem={({ item }) => {
          const typeStyle = TYPE_COLORS[item.type] ?? TYPE_COLORS.internal;
          const statusStyle = STATUS_COLORS[item.status] ?? STATUS_COLORS.open;
          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.project && (
                <Text style={styles.cardProject}>
                  {typeof item.project === 'object' ? item.project.title : ''}
                </Text>
              )}
              <View style={styles.badges}>
                <View style={[styles.badge, { backgroundColor: typeStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: typeStyle.text }]}>
                    {item.type.replace('_', ' ')}
                  </Text>
                </View>
                <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
                  <Text style={[styles.badgeText, { color: statusStyle.text }]}>
                    {item.status.replace('_', ' ')}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
              ) : null}
            </View>
          );
        }}
      />

      {/* Raise Blocker Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={styles.modalContainer} contentContainerStyle={{ paddingBottom: 48 }}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Raise Blocker</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Title *</Text>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder="What is blocking progress?"
              placeholderTextColor="#94A3B8"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Describe the issue in detail…"
              placeholderTextColor="#94A3B8"
              multiline
              numberOfLines={4}
            />

            <Text style={styles.label}>Type *</Text>
            <View style={styles.typeRow}>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'internal' && styles.typeBtnActive]}
                onPress={() => setType('internal')}
                accessibilityLabel="Internal blocker"
              >
                <Text style={[styles.typeBtnText, type === 'internal' && styles.typeBtnTextActive]}>
                  Internal
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.typeBtn, type === 'client_side' && styles.typeBtnActive]}
                onPress={() => setType('client_side')}
                accessibilityLabel="Client-side blocker"
              >
                <Text style={[styles.typeBtnText, type === 'client_side' && styles.typeBtnTextActive]}>
                  Client-side
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Project *</Text>
            <TouchableOpacity
              style={[styles.input, styles.pickerBtn, !selectedProject && formError ? styles.inputError : null]}
              onPress={() => setShowProjectPicker(true)}
              accessibilityLabel="Select project"
            >
              <Text style={selectedProject ? styles.pickerText : styles.pickerPlaceholder}>
                {selectedProject ? selectedProject.title : 'Select a project…'}
              </Text>
              <Text style={styles.pickerChevron}>›</Text>
            </TouchableOpacity>

            {formError ? <Text style={styles.error}>{formError}</Text> : null}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={submitting}
              accessibilityLabel="Submit blocker"
            >
              <Text style={styles.submitBtnText}>
                {submitting ? 'Submitting…' : 'Submit Blocker'}
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
            <Text style={styles.empty}>No projects assigned to you.</Text>
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
                    if (formError) setFormError('');
                  }}
                  accessibilityLabel={`Select project ${item.title}`}
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  heading: { fontSize: 24, fontWeight: '700', color: '#0F172A' },
  raiseBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 40,
    justifyContent: 'center',
  },
  raiseBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  empty: { textAlign: 'center', color: '#94A3B8', marginTop: 48, fontSize: 15 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  cardProject: { fontSize: 12, color: '#64748B', marginTop: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  desc: { fontSize: 13, color: '#64748B', marginTop: 8, lineHeight: 18 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: '#fff', padding: 20 },
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
  inputError: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  typeBtnActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  typeBtnTextActive: { color: '#4F46E5' },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
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
  // Project picker modal
  pickerModal: { flex: 1, backgroundColor: '#fff', padding: 20 },
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
  projectPickerItemActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  projectPickerText: { fontSize: 15, color: '#0F172A', flex: 1, fontWeight: '500' },
  projectPickerTextActive: { color: '#4F46E5', fontWeight: '700' },
});
