import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { api } from '../../../../src/services/api';
import { enqueue } from '../../../../src/store/slices/offline-queue.slice';
import type { RootState } from '../../../../src/store';
import type { Task } from '@ti/shared';

type TaskPopulated = Task & { assignedTo?: { name: string } };

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useDispatch();
  const offlineQueue = useSelector((s: RootState) => s.offlineQueue.queue);
  const [tasks, setTasks] = useState<TaskPopulated[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTasks = useCallback(async () => {
    try {
      const res = await api.get<TaskPopulated[]>(`/projects/${id}/tasks`);
      setTasks(res.data);
    } catch {
      // offline — show cached tasks (empty for now; full offline cache in Phase 2)
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  async function markDone(taskId: string) {
    try {
      await api.patch(`/tasks/${taskId}`, { status: 'done' });
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: 'done' as const } : t)),
      );
    } catch {
      dispatch(
        enqueue({
          type: 'task_update',
          payload: { taskId, data: { status: 'done' } },
        }),
      );
      Alert.alert('Offline', t('offline'));
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: 'done' as const } : t)),
      );
    }
  }

  async function uploadPhoto(taskId: string) {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo access to upload.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];

    try {
      const form = new FormData();
      form.append('file', {
        uri: asset.uri,
        type: asset.mimeType ?? 'image/jpeg',
        name: asset.fileName ?? 'photo.jpg',
      } as unknown as Blob);
      form.append('projectId', id);
      form.append('type', 'photo');

      await api.post('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert('Success', 'Photo uploaded.');
    } catch {
      dispatch(
        enqueue({
          type: 'document_upload',
          payload: {
            uri: asset.uri,
            mimeType: asset.mimeType ?? 'image/jpeg',
            fileName: asset.fileName ?? 'photo.jpg',
            projectId: id,
            type: 'photo',
          },
        }),
      );
      Alert.alert('Offline', 'Photo queued for upload when online.');
    }
  }

  const pendingCount = offlineQueue.length;

  // Raise Handover state
  const [showHandover, setShowHandover] = useState(false);
  const [fromDept, setFromDept] = useState('');
  const [toDept, setToDept] = useState('');
  const [handoverNotes, setHandoverNotes] = useState('');
  const [proofUri, setProofUri] = useState<string | null>(null);
  const [handoverLoading, setHandoverLoading] = useState(false);
  const [handoverMsg, setHandoverMsg] = useState('');

  async function pickProofPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission required', 'Allow photo access to add proof.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setProofUri(result.assets[0].uri);
    }
  }

  async function submitHandover() {
    if (!proofUri) {
      Alert.alert('Proof required', 'At least one proof photo is required.');
      return;
    }
    if (!fromDept || !toDept) {
      Alert.alert('Missing fields', 'From and To department IDs are required.');
      return;
    }
    setHandoverLoading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: proofUri, type: 'image/jpeg', name: 'proof.jpg' } as unknown as Blob);
      form.append('projectId', id);
      form.append('type', 'photo');
      const docRes = await api.post<{ _id: string }>('/documents/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const documentId = docRes.data._id;

      await api.post('/handovers', {
        projectId: id,
        fromDepartment: fromDept,
        toDepartment: toDept,
        proofFileIds: [documentId],
        notes: handoverNotes,
      });

      setHandoverMsg('Handover raised successfully.');
      setShowHandover(false);
      setFromDept('');
      setToDept('');
      setHandoverNotes('');
      setProofUri(null);
    } catch {
      setHandoverMsg('Failed to raise handover. Please try again.');
    } finally {
      setHandoverLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {pendingCount} action{pendingCount > 1 ? 's' : ''} pending sync
          </Text>
        </View>
      )}

      <View style={styles.headerRow}>
        <Text style={styles.heading}>{t('tasks')}</Text>
        <TouchableOpacity
          style={styles.chatBtn}
          onPress={() => router.push(`/projects/${id}/chat` as never)}
          accessibilityLabel="Open project chat"
        >
          <Text style={styles.chatBtnText}>💬 Chat</Text>
        </TouchableOpacity>
      </View>

      {tasks.length === 0 && <Text style={styles.empty}>{t('noTasks')}</Text>}
      {tasks.map((item) => (
        <View key={item._id} style={styles.taskCard}>
          <View style={styles.taskRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.taskTitle}>{item.title}</Text>
              <Text style={styles.taskSub}>
                {typeof item.assignedTo === 'object' && item.assignedTo
                  ? item.assignedTo.name
                  : ''}
                {' · '}
                <Text
                  style={[
                    styles.taskStatus,
                    item.status === 'done' && styles.taskDone,
                    item.status === 'blocked' && styles.taskBlocked,
                  ]}
                >
                  {t(item.status, item.status)}
                </Text>
              </Text>
            </View>
            <View style={styles.taskActions}>
              {item.status !== 'done' && (
                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={() => markDone(item._id)}
                  accessibilityLabel="Mark task done"
                >
                  <Text style={styles.doneBtnText}>✓</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.photoBtn}
                onPress={() => uploadPhoto(item._id)}
                accessibilityLabel="Upload photo for task"
              >
                <Text style={styles.photoBtnText}>📷</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ))}

      {/* Raise Handover */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Handover</Text>
        <TouchableOpacity
          style={styles.toggleBtn}
          onPress={() => { setShowHandover((v) => !v); setHandoverMsg(''); }}
        >
          <Text style={styles.toggleBtnText}>{showHandover ? '✕ Cancel' : '＋ Raise Handover'}</Text>
        </TouchableOpacity>
      </View>

      {handoverMsg ? (
        <Text style={[styles.handoverMsg, handoverMsg.startsWith('Failed') && styles.handoverMsgError]}>
          {handoverMsg}
        </Text>
      ) : null}

      {showHandover && (
        <View style={styles.handoverCard}>
          <Text style={styles.inputLabel}>From Department ID</Text>
          <TextInput
            style={styles.input}
            value={fromDept}
            onChangeText={setFromDept}
            placeholder="From Dept ID"
            autoCapitalize="none"
          />
          <Text style={styles.inputLabel}>To Department ID</Text>
          <TextInput
            style={styles.input}
            value={toDept}
            onChangeText={setToDept}
            placeholder="To Dept ID"
            autoCapitalize="none"
          />
          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={handoverNotes}
            onChangeText={setHandoverNotes}
            placeholder="Optional notes"
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity style={styles.proofBtn} onPress={pickProofPhoto}>
            <Text style={styles.proofBtnText}>
              {proofUri ? '✅ Proof photo selected' : '📷 Add Proof Photo *'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitBtn, handoverLoading && styles.submitBtnDisabled]}
            onPress={submitHandover}
            disabled={handoverLoading}
          >
            <Text style={styles.submitBtnText}>
              {handoverLoading ? 'Submitting…' : 'Submit Handover'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingTop: 56 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  chatBtn: { marginLeft: 'auto', backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  chatBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827' },
  empty: { textAlign: 'center', color: '#9CA3AF', marginTop: 40, fontSize: 15 },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  offlineBannerText: { color: '#92400E', fontSize: 13 },
  taskCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  taskTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  taskSub: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  taskStatus: { color: '#6B7280' },
  taskDone: { color: '#059669' },
  taskBlocked: { color: '#DC2626' },
  taskActions: { flexDirection: 'row', gap: 8 },
  doneBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 18, color: '#059669' },
  photoBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#EFF6FF',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoBtnText: { fontSize: 18 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#EEF2FF', borderRadius: 8 },
  toggleBtnText: { color: '#4F46E5', fontWeight: '600', fontSize: 13 },
  handoverCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  inputLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4, marginTop: 8 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 14, fontSize: 15, color: '#111827', backgroundColor: '#FAFAFA' },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  proofBtn: { marginTop: 12, paddingVertical: 14, backgroundColor: '#EEF2FF', borderRadius: 10, alignItems: 'center' },
  proofBtnText: { color: '#4F46E5', fontWeight: '600', fontSize: 15 },
  submitBtn: { marginTop: 12, paddingVertical: 16, backgroundColor: '#4F46E5', borderRadius: 10, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  handoverMsg: { color: '#059669', fontSize: 13, marginBottom: 8 },
  handoverMsgError: { color: '#DC2626' },
});
