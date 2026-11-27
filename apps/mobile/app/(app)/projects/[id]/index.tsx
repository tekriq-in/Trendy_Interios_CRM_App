import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { PERMISSIONS } from '@ti/shared';
import { api, describeApiError } from '../../../../src/services/api';
import { usePermissions } from '../../../../src/hooks/usePermissions';
import { useTaskActions } from '../../../../src/hooks/useTaskActions';
import { Toast, useToast } from '../../../../src/components/Toast';
import { Badge, Button, Card, ErrorState, ProgressBar, ScreenHeader } from '../../../../src/components/ui';
import { StageStepper, type StageDept } from '../../../../src/components/project/StageStepper';
import { TaskCard, type TaskRow } from '../../../../src/components/project/TaskCard';
import { HandoverItem, type HandoverRow } from '../../../../src/components/project/HandoverItem';
import { RaiseHandoverSheet } from '../../../../src/components/project/RaiseHandoverSheet';
import { RaiseBlockerSheet } from '../../../../src/components/project/RaiseBlockerSheet';
import { RejectHandoverSheet } from '../../../../src/components/project/RejectHandoverSheet';
import { PendingPhotos } from '../../../../src/components/project/PendingPhotos';
import { PendingHandovers } from '../../../../src/components/project/PendingHandovers';
import { AddPhotoSheet } from '../../../../src/components/project/AddPhotoSheet';
import type { PickedPhoto } from '../../../../src/utils/photo';
import type { RootState } from '../../../../src/store';
import { colors, font, radius, spacing } from '../../../../src/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ProjectData {
  _id: string;
  title: string;
  progressPct: number;
  targetDate?: string;
  client?: { name?: string; phone?: string };
  currentStage?: { _id: string; name: string } | string;
}
interface DocRow {
  _id: string;
  fileName: string;
  driveLink: string;
  mimeType: string;
  type: string;
}

function displayFileName(fileName: string): string {
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { can } = usePermissions();
  const { toast, show: showToast, hide: hideToast } = useToast();
  const pendingHandoverCount = useSelector((state: RootState) =>
    state.offlineQueue.queue.filter((item) => item.type === 'handover_create' && item.payload.projectId === id).length,
  );

  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [stages, setStages] = useState<StageDept[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [handovers, setHandovers] = useState<HandoverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [showHandover, setShowHandover] = useState(false);
  const [showBlocker, setShowBlocker] = useState(false);
  const [photoTarget, setPhotoTarget] = useState<{ taskId?: string } | null>(null);
  const [rejecting, setRejecting] = useState<HandoverRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [proj, taskRes, deptRes, docRes, hoRes] = await Promise.allSettled([
        api.get<ProjectData>(`/projects/${id}`),
        api.get<TaskRow[]>(`/projects/${id}/tasks`),
        api.get<StageDept[]>('/departments'),
        api.get<DocRow[]>('/documents', { params: { projectId: id } }),
        api.get<HandoverRow[]>('/handovers', { params: { projectId: id } }),
      ]);
      // The project itself is required; the rest degrade to empty lists.
      if (proj.status === 'rejected') throw proj.reason;
      setProject(proj.value.data);
      if (taskRes.status === 'fulfilled') setTasks(taskRes.value.data);
      if (deptRes.status === 'fulfilled') setStages([...deptRes.value.data].sort((a, b) => a.order - b.order));
      if (docRes.status === 'fulfilled') setDocs(docRes.value.data);
      if (hoRes.status === 'fulfilled') setHandovers(hoRes.value.data);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  const refreshAfterQueuedHandover = useCallback(() => {
    void load();
  }, [load]);

  const currentId = typeof project?.currentStage === 'object' ? project.currentStage._id : (project?.currentStage ?? '');
  const currentIdx = stages.findIndex((s) => s._id === currentId);
  const currentStage = stages[currentIdx];
  const nextStage = stages[currentIdx + 1];
  const stageName = typeof project?.currentStage === 'object' ? project.currentStage.name : currentStage?.name;

  const dueFmt = useMemo(() => {
    if (!project?.targetDate) return null;
    const d = new Date(project.targetDate);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString(i18n.language === 'ta' ? 'ta-IN' : 'en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' });
  }, [project?.targetDate, i18n.language]);

  // ---- task actions (shared with the Tasks tab) ---------------------------

  const taskActions = useTaskActions({
    onStatusChanged: (taskId, status) =>
      setTasks((prev) => prev.map((x) => (x._id === taskId ? { ...x, status } : x))),
    onReload: () => void load(),
    notify: showToast,
  });

  // ---- handover actions ---------------------------------------------------

  async function handoverAction(h: HandoverRow, action: 'confirm' | 'accept') {
    setBusyId(h._id);
    try {
      await api.patch(`/handovers/${h._id}/${action}`);
      void load();
    } catch (err) {
      showToast(describeApiError(err, t('common.checkConnection')), 'error');
    } finally {
      setBusyId(null);
    }
  }

  // ---- render -------------------------------------------------------------

  if (loading) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('common.loading')} back />
      </View>
    );
  }

  if (failed || !project) {
    return (
      <View style={styles.root}>
        <ScreenHeader title={t('project.loadFailed')} back />
        <ErrorState
          title={t('common.couldNotLoad')}
          message={`${t('common.checkConnection')}\n${t('common.serverWaking')}`}
          retryLabel={t('common.retry')}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </View>
    );
  }

  const canRaiseHandover = can(PERMISSIONS.HANDOVERS_RAISE) && !!currentStage && !!nextStage;
  const canRaiseBlocker = can(PERMISSIONS.BLOCKERS_RAISE);
  const canUpload = can(PERMISSIONS.DOCUMENTS_UPLOAD);
  const canEditTasks = can(PERMISSIONS.TASKS_EDIT);

  return (
    <View style={styles.root}>
      <Toast message={toast.message} kind={toast.kind} visible={toast.visible} onHide={hideToast} />
      <ScreenHeader title={project.title} subtitle={project.client?.name} back />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Readiness */}
        <Card>
          <View style={styles.rowBetween}>
            <Text style={font.h3}>{t('projects.readiness')}</Text>
            {stageName ? <Badge label={stageName} tone="primary" /> : null}
          </View>
          <View style={{ height: 12 }} />
          <ProgressBar value={project.progressPct} height={12} />
          {dueFmt ? <Text style={styles.target}>{t('project.targetDate')}: {dueFmt}</Text> : null}
        </Card>

        {/* Keep queued photos near the top so they are visible after capture. */}
        <PendingPhotos projectId={id} />

        {/* Stage stepper */}
        {stages.length > 0 ? (
          <>
            <Text style={styles.section}>{t('project.stages')}</Text>
            <StageStepper stages={stages} currentId={currentId} />
          </>
        ) : null}

        {/* Quick actions */}
        <Text style={styles.section}>{t('project.actions')}</Text>
        <View style={styles.grid}>
          {canUpload ? <Action icon="camera" label={t('project.addPhoto')} onPress={() => setPhotoTarget({})} /> : null}
          {canRaiseBlocker ? <Action icon="warning" label={t('project.raiseBlocker')} onPress={() => setShowBlocker(true)} tone="danger" /> : null}
          <Action icon="chatbubbles" label={t('project.chat')} onPress={() => router.push(`/projects/${id}/chat` as never)} />
          <Action icon="cart" label={t('project.items')} onPress={() => router.push(`/projects/${id}/purchase-items` as never)} />
        </View>

        {/* Tasks */}
        <Text style={styles.section}>{t('project.tasks')}</Text>
        {tasks.length === 0 ? (
          <Card>
            <Text style={styles.empty}>{t('project.noTasks')}</Text>
          </Card>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task._id}
              task={task}
              busy={taskActions.busyId === task._id}
              canEdit={canEditTasks}
              onStart={() => taskActions.setStatus(task._id, 'in_progress')}
              onDone={() => taskActions.setStatus(task._id, 'done')}
              onPhoto={() => setPhotoTarget({ taskId: task._id })}
            />
          ))
        )}

        {/* Handover */}
        <View style={styles.rowBetween}>
          <Text style={styles.section}>{t('project.handover')}</Text>
        </View>
        {canRaiseHandover ? (
          <View style={{ marginBottom: spacing.md }}>
            <Button label={`${t('handover.raise')}: ${nextStage?.name ?? ''}`} icon="swap-horizontal" onPress={() => setShowHandover(true)} />
          </View>
        ) : !nextStage && currentStage ? (
          <Text style={styles.final}>{t('project.finalStage')}</Text>
        ) : null}
        <PendingHandovers projectId={id} departments={stages} onSynced={refreshAfterQueuedHandover} />
        {handovers.length === 0 && pendingHandoverCount === 0 ? (
          <Card>
            <Text style={styles.empty}>{t('handover.none')}</Text>
          </Card>
        ) : null}
        {handovers.map((h) => (
            <HandoverItem
              key={h._id}
              handover={h}
              canConfirm={can(PERMISSIONS.HANDOVERS_CONFIRM_FROM)}
              canAccept={can(PERMISSIONS.HANDOVERS_ACCEPT_TO)}
              busy={busyId === h._id}
              onConfirm={() => handoverAction(h, 'confirm')}
              onAccept={() => handoverAction(h, 'accept')}
              onReject={() => setRejecting(h)}
            />
          ))}

        {/* Documents */}
        {docs.length > 0 ? (
          <>
            <Text style={styles.section}>{t('project.documents')}</Text>
            {docs.map((d) => (
              <Card
                key={d._id}
                style={styles.doc}
                onPress={() => WebBrowser.openBrowserAsync(d.driveLink)}
                accessibilityLabel={d.fileName}
              >
                <View style={styles.docIcon}>
                  <Ionicons name={d.mimeType.includes('pdf') ? 'document-text' : 'image'} size={22} color={colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text style={font.bodyStrong} numberOfLines={1}>{displayFileName(d.fileName)}</Text>
                  <Text style={font.caption}>{d.type.replace('drawing_', '').replace(/_/g, ' ')}</Text>
                </View>
                <Text style={styles.view}>{t('project.view')}</Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      {/* Sheets */}
      {currentStage && nextStage ? (
        <RaiseHandoverSheet
          visible={showHandover}
          onClose={() => setShowHandover(false)}
          projectId={id}
          from={currentStage}
          to={nextStage}
          onRaised={(queued) => {
            showToast(queued ? t('task.savedOffline') : t('handover.submitted'), queued ? 'info' : 'success');
            if (!queued) void load();
          }}
        />
      ) : null}
      <RaiseBlockerSheet
        visible={showBlocker}
        onClose={() => setShowBlocker(false)}
        projectId={id}
        onRaised={(queued) => showToast(queued ? t('task.savedOffline') : t('blocker.raised'), queued ? 'info' : 'success')}
      />
      <RejectHandoverSheet handover={rejecting} onClose={() => setRejecting(null)} onRejected={() => void load()} />
      <AddPhotoSheet
        visible={photoTarget !== null}
        onClose={() => setPhotoTarget(null)}
        onUpload={(photo: PickedPhoto, fileName: string) => taskActions.addPhoto(
          { projectId: id, departmentId: currentStage?._id, taskId: photoTarget?.taskId },
          photo,
          fileName,
        )}
      />
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  tone = 'primary',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger';
}) {
  const fg = tone === 'danger' ? colors.danger : colors.primary;
  const bg = tone === 'danger' ? colors.dangerSoft : colors.primarySoft;
  return (
    <View style={styles.actionCell}>
      <Card onPress={onPress} accessibilityLabel={label} style={styles.action}>
        <View style={[styles.actionIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={26} color={fg} />
        </View>
        <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 48 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  section: { ...font.h2, marginTop: spacing.xl, marginBottom: spacing.md },
  target: { ...font.caption, marginTop: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  actionCell: { width: '50%', padding: 6 },
  action: { alignItems: 'center', paddingVertical: spacing.lg },
  actionIcon: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabel: { ...font.bodyStrong, textAlign: 'center' },
  empty: { ...font.body, color: colors.textSubtle, textAlign: 'center', paddingVertical: 8 },
  final: { color: colors.success, fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  doc: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  docIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  view: { color: colors.primary, fontWeight: '800', fontSize: 15 },
});
