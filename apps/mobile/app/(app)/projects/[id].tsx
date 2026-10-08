import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { api } from '../../../src/services/api';
import { enqueue } from '../../../src/store/slices/offline-queue.slice';
import type { RootState } from '../../../src/store';
import type { Task } from '@ti/shared';

type TaskPopulated = Task & { assignedTo?: { name: string } };

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {pendingCount > 0 && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>
            {pendingCount} action{pendingCount > 1 ? 's' : ''} pending sync
          </Text>
        </View>
      )}

      <Text style={styles.heading}>{t('tasks')}</Text>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 24 }}
        ListEmptyComponent={<Text style={styles.empty}>{t('noTasks')}</Text>}
        renderItem={({ item }) => (
          <View style={styles.taskCard}>
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
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', paddingHorizontal: 16, paddingTop: 56 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 12 },
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
});
