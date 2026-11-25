import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, describeApiError } from '../../services/api';
import { Button, Chip, Sheet, TextField } from '../ui';
import { colors, font, radius, spacing } from '../../theme';

export interface ProjectOption {
  _id: string;
  title: string;
  currentStage?: { _id?: string; name?: string } | string;
}

type DueChoice = 'none' | 'today' | 'tomorrow' | 'in3' | 'week';

interface Props {
  visible: boolean;
  onClose: () => void;
  projects: ProjectOption[];
  /** The signed-in user: new tasks from the phone are assigned to them. */
  userId: string | null;
  onCreated: () => void;
}

function dueDate(choice: DueChoice): string | undefined {
  if (choice === 'none') return undefined;
  const days = { today: 0, tomorrow: 1, in3: 3, week: 7 }[choice];
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(18, 0, 0, 0); // end of the working day, local time
  return d.toISOString();
}

const stageId = (p: ProjectOption) => (typeof p.currentStage === 'object' ? p.currentStage?._id : p.currentStage);

/**
 * Create a task for yourself. Nothing is typed except the title: the project and
 * the due date are chosen with large chips (SOW: minimal typing). The API needs a
 * department and an assignee, so the project's current stage and the signed-in
 * user are used. (The previous version sent neither, so every create failed.)
 */
export function CreateTaskSheet({ visible, onClose, projects, userId, onCreated }: Props) {
  const { t } = useTranslation();
  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [due, setDue] = useState<DueChoice>('none');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setProjectId(projects.length === 1 ? projects[0]._id : '');
      setTitle('');
      setDue('none');
      setError('');
    }
  }, [visible, projects]);

  async function save() {
    const project = projects.find((p) => p._id === projectId);
    if (!project) {
      setError(t('tasks.pickProject'));
      return;
    }
    if (!title.trim()) {
      setError(t('tasks.titleRequired'));
      return;
    }
    const departmentId = stageId(project);
    if (!departmentId || !userId) {
      setError(t('blocker.failed'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/projects/${project._id}/tasks`, {
        title: title.trim(),
        departmentId,
        assignedToId: userId,
        dueDate: dueDate(due),
      });
      onCreated();
      onClose();
    } catch (err) {
      const msg = describeApiError(err, t('blocker.failed'));
      setError(msg === 'offline' ? t('common.checkConnection') : msg);
    } finally {
      setSaving(false);
    }
  }

  const dueOptions: { key: DueChoice; label: string }[] = [
    { key: 'none', label: t('tasks.dueNone') },
    { key: 'today', label: t('tasks.dueToday') },
    { key: 'tomorrow', label: t('tasks.dueTomorrow') },
    { key: 'in3', label: t('tasks.dueIn3') },
    { key: 'week', label: t('tasks.dueWeek') },
  ];

  return (
    <Sheet visible={visible} title={t('tasks.add')} onClose={onClose}>
      <TextField label={t('tasks.taskTitle')} value={title} onChangeText={setTitle} maxLength={200} />

      <Text style={styles.label}>{t('tasks.project')}</Text>
      <View style={styles.chips}>
        {projects.map((p) => (
          <Chip key={p._id} label={p.title} selected={projectId === p._id} onPress={() => setProjectId(p._id)} />
        ))}
      </View>

      <Text style={styles.label}>{t('tasks.dueDate')}</Text>
      <View style={styles.chips}>
        {dueOptions.map((o) => (
          <Chip key={o.key} label={o.label} selected={due === o.key} onPress={() => setDue(o.key)} />
        ))}
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label={t('tasks.create')} icon="add" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { ...font.label, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
