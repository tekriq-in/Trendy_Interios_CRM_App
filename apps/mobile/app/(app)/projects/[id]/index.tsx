import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
  ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../src/services/api';
import { enqueue } from '../../../../src/store/slices/offline-queue.slice';
import type { RootState } from '../../../../src/store';
import type { Task } from '@ti/shared';

type TaskPopulated = Task & { assignedTo?: { name: string } };
interface Dept { _id: string; name: string; order: number; }
interface Project {
  _id: string; title: string; progressPct: number; status: string;
  currentStage?: Dept | string;
}
interface TIDocument { _id: string; fileName: string; driveLink: string; mimeType: string; type: string; }

const STATUS_DOT: Record<string, string> = {
  done: '#10B981', in_progress: '#3B82F6', blocked: '#EF4444', pending: '#94A3B8',
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const offlineQueue = useSelector((s: RootState) => s.offlineQueue.queue);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<TaskPopulated[]>([]);
  const [departments, setDepartments] = useState<Dept[]>([]);
  const [documents, setDocuments] = useState<TIDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Handover state
  const [showHandover, setShowHandover] = useState(false);
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [projRes, tasksRes, deptsRes, docsRes] = await Promise.all([
        api.get<Project>(`/projects/${id}`),
        api.get<TaskPopulated[]>(`/projects/${id}/tasks`),
        api.get<Dept[]>('/departments'),
        api.get<TIDocument[]>('/documents', { params: { projectId: id } }),
      ]);
      setProject(projRes.data);
      setTasks(tasksRes.data);
      setDepartments(deptsRes.data.sort((a, b) => a.order - b.order));
      setDocuments(docsRes.data);
    } catch {
      // offline
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function markDone(taskId: string) {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'done' });
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'done' as const } : t));
    } catch {
      dispatch(enqueue({ type: 'task_update', payload: { taskId, data: { status: 'done' } } }));
      Alert.alert('Offline', t('offline'));
      setTasks((prev) => prev.map((t) => t._id === taskId ? { ...t, status: 'done' as const } : t));
    }
  }

  async function openDocument(url: string) {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
  }

  async function uploadPhoto(taskId: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: asset.fileName ?? 'photo.jpg' } as unknown as Blob);
      form.append('projectId', id);
      form.append('type', 'photo');
      await api.post('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Uploaded', 'Photo uploaded successfully.');
    } catch {
      dispatch(enqueue({ type: 'document_upload', payload: { uri: asset.uri, mimeType: asset.mimeType ?? 'image/jpeg', fileName: asset.fileName ?? 'photo.jpg', projectId: id, type: 'photo' } }));
      Alert.alert('Offline', 'Photo queued for upload.');
    }
  }

  async function pickProof() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });
    if (!result.canceled && result.assets[0]) setProofUri(result.assets[0].uri);
  }

  async function submitHandover() {
    if (!proofUri) { Alert.alert('Proof required', 'Take a photo as proof before raising handover.'); return; }

    const currentStageId = typeof project?.currentStage === 'object' ? project.currentStage._id : project?.currentStage;
    const currentIdx = departments.findIndex((d) => d._id === currentStageId);
    const fromDept = departments[currentIdx];
    const toDept = departments[currentIdx + 1];

    if (!fromDept || !toDept) {
      Alert.alert('Cannot raise handover', 'This project is already at the final stage.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Upload proof photo
      const form = new FormData();
      form.append('file', { uri: proofUri, type: 'image/jpeg', name: 'handover-proof.jpg' } as unknown as Blob);
      form.append('projectId', id);
      form.append('type', 'photo');
      const docRes = await api.post<{ _id: string }>('/documents/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });

      // 2. Raise handover
      await api.post('/handovers', {
        projectId: id,
        fromDepartmentId: fromDept._id,
        toDepartmentId: toDept._id,
        proofFileIds: [docRes.data._id],
        notes: notes.trim() || undefined,
      });

      Alert.alert('Done', `Handover from ${fromDept.name} to ${toDept.name} raised successfully.`);
      setShowHandover(false);
      setProofUri(null);
      setNotes('');
    } catch {
      Alert.alert('Error', 'Failed to raise handover. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator color="#4F46E5" size="large" /></View>;

  const currentStageId = typeof project?.currentStage === 'object' ? project?.currentStage?._id : project?.currentStage;
  const currentIdx = departments.findIndex((d) => d._id === currentStageId);
  const currentDept = departments[currentIdx];
  const nextDept = departments[currentIdx + 1];
  const pendingCount = offlineQueue.length;

  return (
    <ScrollView style={s.container} contentContainerStyle={{ paddingBottom: 48 }}>
      {pendingCount > 0 && (
        <View style={s.offlineBanner}>
          <Text style={s.offlineBannerText}>{pendingCount} action{pendingCount > 1 ? 's' : ''} pending sync</Text>
        </View>
      )}

      {/* Header */}
      <View style={s.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.projectTitle}>{project?.title ?? '…'}</Text>
          {currentDept && <Text style={s.stageName}>{currentDept.name}</Text>}
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>
          <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/projects/${id}/purchase-items` as never)}>
            <Text style={s.chatBtnText}>🛒 Items</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.chatBtn} onPress={() => router.push(`/projects/${id}/chat` as never)}>
            <Text style={s.chatBtnText}>💬 Chat</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Progress bar */}
      <View style={s.progressBg}>
        <View style={[s.progressFill, { width: `${project?.progressPct ?? 0}%` as unknown as number }]} />
      </View>
      <Text style={s.progressLabel}>{project?.progressPct ?? 0}% complete</Text>

      {/* Tasks */}
      <Text style={s.sectionLabel}>TASKS</Text>
      {tasks.length === 0 && <Text style={s.empty}>No tasks yet.</Text>}
      {tasks.map((task) => (
        <View key={task._id} style={s.taskCard}>
          <View style={[s.statusDot, { backgroundColor: STATUS_DOT[task.status] ?? '#94A3B8' }]} />
          <View style={{ flex: 1 }}>
            <Text style={s.taskTitle}>{task.title}</Text>
            <Text style={s.taskSub}>{task.assignedTo?.name ?? ''} · {task.status.replace('_', ' ')}</Text>
          </View>
          <View style={s.taskBtns}>
            {task.status !== 'done' && (
              <TouchableOpacity style={s.doneBtn} onPress={() => markDone(task._id)} accessibilityLabel="Mark done">
                <Text style={s.doneBtnText}>✓</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.photoBtn} onPress={() => uploadPhoto(task._id)} accessibilityLabel="Upload photo">
              <Text style={s.photoBtnText}>📷</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {/* Documents */}
      {documents.length > 0 && (
        <>
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>DOCUMENTS & DRAWINGS</Text>
          {documents.map((doc) => (
            <TouchableOpacity
              key={doc._id}
              style={s.docCard}
              onPress={() => openDocument(doc.driveLink)}
              accessibilityLabel={`View ${doc.fileName}`}
            >
              <View style={s.docIcon}>
                <Text style={s.docIconText}>
                  {doc.mimeType === 'application/pdf' || doc.fileName.endsWith('.pdf') ? '📄' : '🖼️'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.docName} numberOfLines={1}>{doc.fileName}</Text>
                <Text style={s.docType}>{doc.type.replace('drawing_', '').replace('_', ' ')}</Text>
              </View>
              <Text style={s.docViewBtn}>View</Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* Handover section */}
      <View style={s.sectionRow}>
        <Text style={s.sectionLabel}>HANDOVER</Text>
        {!showHandover && nextDept && (
          <TouchableOpacity style={s.raiseBtn} onPress={() => setShowHandover(true)}>
            <Text style={s.raiseBtnText}>Raise Handover</Text>
          </TouchableOpacity>
        )}
        {!nextDept && <Text style={s.finalStageText}>Final stage</Text>}
      </View>

      {showHandover && nextDept && (
        <View style={s.handoverCard}>
          {/* From → To */}
          <View style={s.handoverRoute}>
            <View style={s.routePill}>
              <Text style={s.routeLabel}>FROM</Text>
              <Text style={s.routeName}>{currentDept?.name}</Text>
            </View>
            <Text style={s.routeArrow}>→</Text>
            <View style={[s.routePill, s.routePillTo]}>
              <Text style={[s.routeLabel, { color: '#4F46E5' }]}>TO</Text>
              <Text style={[s.routeName, { color: '#4F46E5' }]}>{nextDept.name}</Text>
            </View>
          </View>

          {/* Proof photo */}
          <TouchableOpacity style={proofUri ? [s.proofBtn, s.proofBtnDone] : s.proofBtn} onPress={pickProof} accessibilityLabel="Add proof photo">
            <Text style={proofUri ? [s.proofBtnText, s.proofBtnTextDone] : s.proofBtnText}>
              {proofUri ? '✅ Proof photo added' : '📷 Add Proof Photo (required)'}
            </Text>
          </TouchableOpacity>

          {/* Notes */}
          <TextInput
            style={s.notesInput}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (optional)"
            placeholderTextColor="#94A3B8"
            multiline
            numberOfLines={3}
          />

          <View style={s.handoverBtns}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => { setShowHandover(false); setProofUri(null); setNotes(''); }}>
              <Text style={s.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.submitBtn, (!proofUri || submitting) && s.submitBtnDisabled]}
              onPress={submitHandover}
              disabled={!proofUri || submitting}
              accessibilityLabel="Submit handover"
            >
              <Text style={s.submitBtnText}>{submitting ? 'Submitting…' : 'Submit Handover'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
  offlineBanner: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12 },
  offlineBannerText: { color: '#92400E', fontSize: 13 },

  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  projectTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', flexShrink: 1 },
  stageName: { fontSize: 13, color: '#4F46E5', fontWeight: '600', marginTop: 2 },
  chatBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexShrink: 0 },
  chatBtnText: { color: '#4F46E5', fontWeight: '600', fontSize: 13 },

  progressBg: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%' as unknown as number, backgroundColor: '#4F46E5', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: '#94A3B8', marginBottom: 20, textAlign: 'right' },

  sectionLabel: { fontSize: 10, fontWeight: '700', color: '#94A3B8', letterSpacing: 1, marginBottom: 8 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 8 },
  raiseBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  raiseBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  finalStageText: { fontSize: 12, color: '#10B981', fontWeight: '600' },
  empty: { color: '#94A3B8', fontSize: 14, textAlign: 'center', marginVertical: 16 },

  taskCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  taskTitle: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  taskSub: { fontSize: 12, color: '#64748B', marginTop: 1, textTransform: 'capitalize' },
  taskBtns: { flexDirection: 'row', gap: 6, flexShrink: 0 },
  doneBtn: { width: 44, height: 44, backgroundColor: '#F0FDF4', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  doneBtnText: { fontSize: 18, color: '#10B981' },
  photoBtn: { width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  photoBtnText: { fontSize: 18 },

  handoverCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', gap: 12 },
  handoverRoute: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  routePill: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  routePillTo: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  routeLabel: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.8, textTransform: 'uppercase' },
  routeName: { fontSize: 13, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  routeArrow: { fontSize: 18, color: '#94A3B8', flexShrink: 0 },

  proofBtn: { paddingVertical: 14, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center', borderWidth: 1.5, borderColor: '#CBD5E1', borderStyle: 'dashed' },
  proofBtnDone: { backgroundColor: '#F0FDF4', borderColor: '#A7F3D0', borderStyle: 'solid' },
  proofBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  proofBtnTextDone: { color: '#10B981' },

  notesInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#0F172A', backgroundColor: '#F8FAFC', minHeight: 72, textAlignVertical: 'top' },

  docCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 10 },
  docIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#EEF2FF', justifyContent: 'center' as const, alignItems: 'center' as const, flexShrink: 0 },
  docIconText: { fontSize: 18 },
  docName: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  docType: { fontSize: 11, color: '#64748B', marginTop: 1, textTransform: 'capitalize' },
  docViewBtn: { color: '#4F46E5', fontWeight: '700', fontSize: 13, flexShrink: 0 },

  handoverBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#CBD5E1', alignItems: 'center' },
  cancelBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  submitBtn: { flex: 2, paddingVertical: 14, borderRadius: 10, backgroundColor: '#4F46E5', alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
