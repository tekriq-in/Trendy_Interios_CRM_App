import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Badge, Button, Card } from '../ui';
import { colors, font, spacing, taskStatusTone } from '../../theme';

export interface TaskRow {
  _id: string;
  title: string;
  status: string;
  dueDate?: string;
  assignedTo?: { name?: string } | string;
  photos?: string[];
}

interface TaskCardProps {
  task: TaskRow;
  busy?: boolean;
  /** Hide the action buttons for users without the tasks:edit permission. */
  canEdit?: boolean;
  onStart: () => void;
  onDone: () => void;
  onPhoto: () => void;
}

function formatDue(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // The SOW asks for Indian date formats shown in IST.
  return d.toLocaleDateString(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * One task with the actions a worker needs: start, add a photo, mark done.
 * Buttons are full 52dp and labelled, never icon-only, so they are readable
 * and tappable with a work-worn hand.
 */
export function TaskCard({ task, busy = false, canEdit = true, onStart, onDone, onPhoto }: TaskCardProps) {
  const { t, i18n } = useTranslation();
  const due = formatDue(task.dueDate, i18n.language);
  const assignee = typeof task.assignedTo === 'object' ? task.assignedTo?.name : undefined;
  const photoCount = task.photos?.length ?? 0;
  const isDone = task.status === 'done';

  return (
    <Card style={styles.card}>
      <View style={styles.top}>
        <Text style={[styles.title, isDone && styles.titleDone]}>{task.title}</Text>
        <Badge label={t(`status.${task.status}`, { defaultValue: task.status })} tone={taskStatusTone[task.status] ?? 'neutral'} />
      </View>
      <Text style={styles.meta}>
        {[assignee, due ? t('project.due', { date: due }) : null, photoCount > 0 ? `${photoCount} ${t('task.photo').toLowerCase()}` : null]
          .filter(Boolean)
          .join('  ·  ')}
      </Text>

      {!isDone && canEdit ? (
        <View style={styles.actions}>
          {task.status === 'pending' ? (
            <View style={styles.flex}>
              <Button label={t('task.start')} icon="play" variant="secondary" onPress={onStart} disabled={busy} />
            </View>
          ) : null}
          <View style={styles.flex}>
            <Button label={t('task.photo')} icon="camera" variant="secondary" onPress={onPhoto} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button label={t('task.markDone')} icon="checkmark" onPress={onDone} loading={busy} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  title: { ...font.h3, flex: 1 },
  titleDone: { color: colors.textSubtle, textDecorationLine: 'line-through' },
  meta: { ...font.caption, marginTop: 6 },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
