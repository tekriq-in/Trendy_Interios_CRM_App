import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store';
import type { StageDept } from './StageStepper';
import { retryQueuedAction } from '../../services/sync.service';
import { Button, Card } from '../ui';
import { colors, font, spacing } from '../../theme';

interface Props {
  projectId: string;
  departments: StageDept[];
  onSynced?: () => void;
}

export function PendingHandovers({ projectId, departments, onSynced }: Props) {
  const { t } = useTranslation();
  const queue = useSelector((state: RootState) => state.offlineQueue.queue);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const previousIds = useRef<string[]>([]);
  const pending = queue.filter((item) => item.type === 'handover_create' && item.payload.projectId === projectId);
  const currentKey = pending.map((item) => item.id).join('|');

  useEffect(() => {
    const currentIds = currentKey ? currentKey.split('|') : [];
    const completedIds = previousIds.current.filter((id) => !currentIds.includes(id));
    previousIds.current = currentIds;
    if (completedIds.length > 0) onSynced?.();
  }, [currentKey, onSynced]);

  if (pending.length === 0) return null;

  async function retry(id: string) {
    setRetryingId(id);
    try {
      await retryQueuedAction(id);
    } finally {
      setRetryingId((current) => current === id ? null : current);
    }
  }

  const departmentName = (id: unknown) =>
    typeof id === 'string'
      ? departments.find((department) => department._id === id)?.name ?? t('handover.department')
      : t('handover.department');

  return (
    <View>
      {pending.map((item) => {
        const fromName = departmentName(item.payload.fromDepartmentId);
        const toName = departmentName(item.payload.toDepartmentId);
        const proofCount = Array.isArray(item.payload.proofPhotos) ? item.payload.proofPhotos.length : 0;
        const notes = typeof item.payload.notes === 'string' ? item.payload.notes : '';

        return (
          <Card key={item.id} style={styles.card}>
            <View style={styles.titleRow}>
              <Text style={font.bodyStrong}>{t('handover.pendingTitle')}</Text>
              <Text style={styles.status}>{t('handover.waitingToSync')}</Text>
            </View>
            <Text style={styles.route}>{fromName}  →  {toName}</Text>
            {proofCount > 0 ? <Text style={font.caption}>{t('handover.proofPhotoCount', { count: proofCount })}</Text> : null}
            {notes ? <Text style={font.caption}>{notes}</Text> : null}
            <View style={styles.button}>
              <Button
                label={t('handover.retry')}
                icon="sync-outline"
                variant="secondary"
                block={false}
                loading={retryingId === item.id}
                onPress={() => void retry(item.id)}
              />
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  status: { ...font.caption, color: colors.warning, fontWeight: '700' },
  route: { ...font.body, color: colors.text },
  button: { alignSelf: 'flex-start' },
});
