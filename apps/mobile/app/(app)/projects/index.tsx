import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, TextInput, ScrollView,
  KeyboardAvoidingView, Platform, Switch, ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/services/api';
import { SkeletonProjectCard } from '../../../src/components/Skeleton';
import type { Project } from '@ti/shared';

type ProjectPopulated = Project & {
  client?: { name: string };
  currentStage?: { name: string };
};
type Dept = { _id: string; name: string; order: number };

const LEAD_SOURCES = ['walkin', 'referral', 'marketing', 'other'] as const;

const EMPTY_CLIENT = {
  name: '', phone: '', email: '', address: '',
  leadSource: 'walkin' as string, notes: '', whatsappOptIn: true,
};

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<ProjectPopulated[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // onboarding modal state
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState<'client' | 'project'>('client');
  const [clientForm, setClientForm] = useState({ ...EMPTY_CLIENT });
  const [projectTitle, setProjectTitle] = useState('');
  const [firstStageId, setFirstStageId] = useState('');
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [saving, setSaving] = useState(false);
  const [newClientId, setNewClientId] = useState('');
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.get<ProjectPopulated[]>('/projects');
      setProjects(res.data);
    } catch {
      // silently handle offline
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProjects();
    setRefreshing(false);
  }, [loadProjects]);

  function openOnboarding() {
    setClientForm({ ...EMPTY_CLIENT });
    setProjectTitle('');
    setStep('client');
    setError('');
    setNewClientId('');
    setShowModal(true);
    api.get<Dept[]>('/departments').then(r => {
      const sorted = r.data.sort((a, b) => a.order - b.order);
      setDepartments(sorted);
      setFirstStageId(sorted[0]?._id ?? '');
    }).catch(() => {});
  }

  async function handleSaveClient() {
    if (!clientForm.name.trim() || !clientForm.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    setSaving(true); setError('');
    try {
      const res = await api.post<{ _id: string }>('/clients', {
        name: clientForm.name.trim(),
        phone: clientForm.phone.trim(),
        email: clientForm.email.trim() || undefined,
        address: clientForm.address.trim() || undefined,
        leadSource: clientForm.leadSource,
        notes: clientForm.notes.trim() || undefined,
        whatsappOptIn: clientForm.whatsappOptIn,
      });
      setNewClientId(res.data._id);
      setStep('project');
    } catch {
      setError('Failed to save client. Please try again.');
    } finally { setSaving(false); }
  }

  async function handleCreateProject() {
    if (!projectTitle.trim()) { setError('Project title is required.'); return; }
    setSaving(true); setError('');
    try {
      const res = await api.post<{ _id: string }>('/projects', {
        clientId: newClientId,
        title: projectTitle.trim(),
        firstStageId: firstStageId || undefined,
      });
      setShowModal(false);
      await loadProjects();
      router.push(`/(app)/projects/${res.data._id}`);
    } catch {
      setError('Failed to create project. Client saved — you can create the project later.');
      setShowModal(false);
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <Text style={s.heading}>{t('projects')}</Text>
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonProjectCard key={i} />)}
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.heading}>{t('projects')}</Text>
        <TouchableOpacity style={s.addBtn} onPress={openOnboarding} accessibilityLabel="Add new client">
          <Text style={s.addBtnText}>+ New Client</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={projects}
        keyExtractor={(item) => item._id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={s.empty}>{t('noProjects')}</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={s.card}
            onPress={() => router.push(`/(app)/projects/${item._id}`)}
            accessibilityLabel={`Open project ${item.title}`}
          >
            <Text style={s.cardTitle}>{item.title}</Text>
            <Text style={s.cardSub}>
              {typeof item.client === 'object' && item.client ? item.client.name : ''}
            </Text>
            <View style={s.progressRow}>
              <View style={s.progressBg}>
                <View style={[s.progressFill, { width: `${item.progressPct}%` as `${number}%` }]} />
              </View>
              <Text style={s.progressPct}>{item.progressPct}%</Text>
            </View>
            <Text style={s.stage}>
              {typeof item.currentStage === 'object' && item.currentStage ? item.currentStage.name : ''}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Client Onboarding Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={s.cancelBtn}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={s.modalTitle}>
              {step === 'client' ? 'New Client' : 'Start Project'}
            </Text>
            <View style={{ width: 64 }} />
          </View>

          {/* Step indicator */}
          <View style={s.stepRow}>
            <View style={[s.stepDot, step === 'client' ? s.stepActive : s.stepDone]}>
              <Text style={s.stepNum}>1</Text>
            </View>
            <View style={s.stepLine} />
            <View style={[s.stepDot, step === 'project' ? s.stepActive : s.stepInactive]}>
              <Text style={s.stepNum}>2</Text>
            </View>
            <View style={{ flex: 1 }} />
            <Text style={s.stepLabel}>{step === 'client' ? 'Client Details' : 'Project Details'}</Text>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
            {step === 'client' ? (
              <>
                <Field label="Full Name *" value={clientForm.name}
                  onChangeText={v => setClientForm(p => ({ ...p, name: v }))}
                  placeholder="e.g. Rajesh Kumar" />
                <Field label="Phone *" value={clientForm.phone}
                  onChangeText={v => setClientForm(p => ({ ...p, phone: v }))}
                  placeholder="+91 98765 43210" keyboardType="phone-pad" />
                <Field label="Email" value={clientForm.email}
                  onChangeText={v => setClientForm(p => ({ ...p, email: v }))}
                  placeholder="email@example.com" keyboardType="email-address" />
                <Field label="Address" value={clientForm.address}
                  onChangeText={v => setClientForm(p => ({ ...p, address: v }))}
                  placeholder="123 Anna Nagar, Chennai" />
                <Text style={s.fieldLabel}>Lead Source</Text>
                <View style={s.pillRow}>
                  {LEAD_SOURCES.map(src => (
                    <TouchableOpacity
                      key={src}
                      style={[s.pill, clientForm.leadSource === src && s.pillActive]}
                      onPress={() => setClientForm(p => ({ ...p, leadSource: src }))}
                    >
                      <Text style={[s.pillText, clientForm.leadSource === src && s.pillActiveText]}>
                        {src.charAt(0).toUpperCase() + src.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Field label="Notes" value={clientForm.notes}
                  onChangeText={v => setClientForm(p => ({ ...p, notes: v }))}
                  placeholder="Any notes…" multiline />
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.fieldLabel}>WhatsApp opt-in</Text>
                    <Text style={s.switchDesc}>Client agrees to receive updates via WhatsApp</Text>
                  </View>
                  <Switch
                    value={clientForm.whatsappOptIn}
                    onValueChange={v => setClientForm(p => ({ ...p, whatsappOptIn: v }))}
                    trackColor={{ true: '#4F46E5' }}
                    thumbColor="#fff"
                  />
                </View>
                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity style={s.primaryBtn} onPress={handleSaveClient} disabled={saving}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Save & Continue →</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={s.infoBox}>Client saved. Now create a project for them.</Text>
                <Field label="Project Title *" value={projectTitle}
                  onChangeText={setProjectTitle}
                  placeholder="e.g. Hall Renovation" />
                <Text style={s.fieldLabel}>Starting Department</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                  <View style={s.pillRow}>
                    {departments.map(d => (
                      <TouchableOpacity
                        key={d._id}
                        style={[s.pill, firstStageId === d._id && s.pillActive]}
                        onPress={() => setFirstStageId(d._id)}
                      >
                        <Text style={[s.pillText, firstStageId === d._id && s.pillActiveText]}>
                          {d.order}. {d.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
                {error ? <Text style={s.error}>{error}</Text> : null}
                <TouchableOpacity style={s.primaryBtn} onPress={handleCreateProject} disabled={saving || !projectTitle.trim()}>
                  {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryBtnText}>Create Project →</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={s.skipBtn} onPress={() => { setShowModal(false); loadProjects(); }}>
                  <Text style={s.skipText}>Skip — add project later</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, multiline }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'phone-pad' | 'email-address'; multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.input, multiline && { height: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        multiline={multiline}
        autoCapitalize="none"
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingTop: 56 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  heading: { fontSize: 24, fontWeight: '700', color: '#111827' },
  addBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 16 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  progressBg: { flex: 1, height: 6, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#4F46E5', borderRadius: 4 },
  progressPct: { fontSize: 12, color: '#6B7280', width: 34, textAlign: 'right' },
  stage: { fontSize: 12, color: '#4F46E5', marginTop: 6 },
  // modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  cancelText: { color: '#6B7280', fontSize: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  stepRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderColor: '#E5E7EB',
  },
  stepDot: {
    width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
  },
  stepActive: { backgroundColor: '#4F46E5' },
  stepDone: { backgroundColor: '#10B981' },
  stepInactive: { backgroundColor: '#E5E7EB' },
  stepNum: { color: '#fff', fontSize: 13, fontWeight: '700' },
  stepLine: { width: 24, height: 2, backgroundColor: '#D1D5DB', marginHorizontal: 6 },
  stepLabel: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  form: { padding: 20, paddingBottom: 40 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 12, fontSize: 15, color: '#111827', backgroundColor: '#fff',
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  pill: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff',
  },
  pillActive: { borderColor: '#4F46E5', backgroundColor: '#EEF2FF' },
  pillText: { fontSize: 13, color: '#6B7280' },
  pillActiveText: { color: '#4F46E5', fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  switchDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  error: { color: '#EF4444', fontSize: 13, marginBottom: 12, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8 },
  infoBox: { backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, color: '#166534', fontSize: 14, marginBottom: 20 },
  primaryBtn: {
    backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  skipBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  skipText: { color: '#9CA3AF', fontSize: 14 },
});
