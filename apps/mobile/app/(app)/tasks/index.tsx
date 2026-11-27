import { RefreshControl, SectionList, StyleSheet, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { PERMISSIONS } from '@ti/shared';
import { api } from '../../../src/services/api';
import type { RootState } from '../../../src/store';
import { usePermissions } from '../../../src/hooks/usePermissions';
import { useTaskActions } from '../../../src/hooks/useTaskActions';
import { SkeletonTaskRow } from '../../../src/components/Skeleton';
import { Toast, useToast } from '../../../src/components/Toast';
import { Chip, EmptyState, ErrorState, HeaderIconButton, ScreenHeader } from '../../../src/components/ui';
import { TaskCard, type TaskRow } from '../../../src/components/project/TaskCard';
import { AddPhotoSheet } from '../../../src/components/project/AddPhotoSheet';
import { PendingPhotos } from '../../../src/components/project/PendingPhotos';
import { CreateTaskSheet, type ProjectOption } from '../../../src/components/tasks/CreateTaskSheet';
import type { PickedPhoto } from '../../../src/utils/photo';
import { colors, font, spacing } from '../../../src/theme';

interface ProjectRef extends ProjectOption {
  currentStage?: { _id?: string; name?: string } | string;
}
interface FlatTask extends TaskRow {
  projectId: string;
  projectTitle: string;
  departmentId?: string;
}
type Filter = 'open' | 'done' | 'all';

const ORDER = ['blocked', 'in_progress', 'pending', 'done'] as const;
const GROUP_KEY: Record<(typeof ORDER)[number], string> = {
  blocked: 'tasks.groupBlocked',
  in_progress: 'tasks.groupInProgress',
  pending: 'tasks.groupPending',
  done: 'tasks.groupDone',
};

const assigneeId = (t: TaskRow): string =>
  typeof t.assignedTo === 'object' && t.assignedTo && '_id' in t.assignedTo
    ? String((t.assignedTo as { _id: unknown })._id)
    : typeof t.assignedTo === 'string'
      ? t.assignedTo
      : '';

export default function TasksScreen() {
  const { t } = useTranslation();
  const userId = useSelector((s: RootState) => s.auth.userId);
  const { can } = usePermissions();
  const { toast, show: showToast, hide: hideToast } = useToast();

  const [projects, setProjects] = useState<ProjectRef[]>([]);
  const [tasks, setTasks] = useState<FlatTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('open');
  const [everyone, setEveryone] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<FlatTask | null>(null);

  const load = useCallback(async () => {
    try {
      const proj = await api.get<ProjectRef[]>('/projects');
      setProjects(proj.data);
      // The API has no "my tasks" endpoint yet, so fetch per project (in parallel).
      const results = await Promise.allSettled(
        proj.data.map((p) => api.get<TaskRow[]>(`/projects/${p._id}/tasks`)),
      );
      const flat: FlatTask[] = [];
      results.forEach((r, i) => {
        if (r.status !== 'fulfilled') return;
        const p = proj.data[i];
        const stage = typeof p.currentStage === 'object' ? p.currentStage?._id : undefined;
        r.value.data.forEach((task) =>
          flat.push({ ...task, projectId: p._id, projectTitle: p.title, departmentId: stage }),
        );
      });
      setTasks(flat);
      setFailed(false);
    } catch {
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

  const actions = useTaskActions({
    onStatusChanged: (taskId, status) =>
      setTasks((prev) => prev.map((x) => (x._id === taskId ? { ...x, status } : x))),
    onReload: () => void load(),
    notify: showToast,
  });

  const canSeeOthers = can(PERMISSIONS.PROJECTS_READ_ALL);
  const canCreate = can(PERMISSIONS.TASKS_CREATE);
  const canEdit = can(PERMISSIONS.TASKS_EDIT);

  const mine = useMemo(
    () => tasks.filter((x) => (canSeeOthers && everyone ? true : assigneeId(x) === userId)),
    [tasks, everyone, canSeeOthers, userId],
  );

  const sections = useMemo(() => {
    const keep = (s: string) => (filter === 'all' ? true : filter === 'done' ? s === 'done' : s !== 'done');
    return ORDER.map((status) => ({
      status,
      title: t(GROUP_KEY[status]),
      data: mine.filter((x) => x.status === status && keep(x.status)),
    })).filter((sec) => sec.data.length > 0);
  }, [mine, filter, t]);

  const openCount = mine.filter((x) => x.status !== 'done').length;
  const doneCount = mine.length - openCount;

  return (
    <View style={styles.root}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader
        title={t('tasks.title')}
        subtitle={mine.length ? `${openCount} ${t('tasks.open').toLowerCase()}` : undefined}
        right={canCreate ? <HeaderIconButton icon="add" label={t('tasks.add')} onPress={() => setShowCreate(true)} /> : undefined}
      />

      {loading ? (
        <View style={styles.skeletons}>
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonTaskRow key={i} />
          ))}
        </View>
      ) : failed && tasks.length === 0 ? (
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
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._id}
          stickySectionHeadersEnabled={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View>
              <View style={styles.filters}>
                <Chip label={`${t('tasks.open')} (${openCount})`} selected={filter === 'open'} onPress={() => setFilter('open')} />
                <Chip label={`${t('tasks.done')} (${doneCount})`} selected={filter === 'done'} onPress={() => setFilter('done')} />
                <Chip label={t('tasks.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
                {canSeeOthers ? (
                  <Chip label={everyone ? t('tasks.everyone') : t('tasks.mine')} selected={everyone} onPress={() => setEveryone((v) => !v)} />
                ) : null}
              </View>
              <PendingPhotos />
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              icon="checkbox-outline"
              title={t('tasks.empty')}
              message={t('tasks.emptyMessage')}
              actionLabel={canCreate && projects.length > 0 ? t('tasks.add') : undefined}
              onAction={canCreate ? () => setShowCreate(true) : undefined}
            />
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>
              {section.title} ({section.data.length})
            </Text>
          )}
          renderItem={({ item }) => (
            <TaskCard
              task={item}
              projectTitle={item.projectTitle}
              busy={actions.busyId === item._id}
              canEdit={canEdit}
              onStart={() => actions.setStatus(item._id, 'in_progress')}
              onDone={() => actions.setStatus(item._id, 'done')}
              onPhoto={() => setPhotoTarget(item)}
            />
          )}
        />
      )}

      <CreateTaskSheet
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        projects={projects}
        userId={userId}
        onCreated={() => {
          showToast(t('tasks.created'), 'success');
          void load();
        }}
      />
      <AddPhotoSheet
        visible={photoTarget !== null}
        onClose={() => setPhotoTarget(null)}
        onUpload={(photo: PickedPhoto, fileName: string) => photoTarget
          ? actions.addPhoto(
            { projectId: photoTarget.projectId, departmentId: photoTarget.departmentId, taskId: photoTarget._id },
            photo,
            fileName,
          )
          : Promise.resolve(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  skeletons: { padding: spacing.lg, gap: 8 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  sectionTitle: { ...font.h3, marginTop: spacing.lg, marginBottom: spacing.sm },
});
