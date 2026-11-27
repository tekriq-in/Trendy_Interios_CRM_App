import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import type { RootState } from '../../store';
import { retryQueuedAction } from '../../services/sync.service';
import { Button, Card } from '../ui';
import { colors, font, radius, spacing } from '../../theme';

interface PendingPhoto {
  queueId: string;
  uri: string;
  fileName: string;
}

interface ProofPhoto {
  uri?: unknown;
  fileName?: unknown;
}

export function PendingPhotos({ projectId }: { projectId?: string }) {
  const { t } = useTranslation();
  const queue = useSelector((state: RootState) => state.offlineQueue.queue);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const photos: PendingPhoto[] = [];
  for (const item of queue) {
    if (item.type === 'document_upload' && (!projectId || item.payload.projectId === projectId) && item.payload.type === 'photo') {
      if (typeof item.payload.uri === 'string') {
        photos.push({
          queueId: item.id,
          uri: item.payload.uri,
          fileName: typeof item.payload.fileName === 'string' ? item.payload.fileName : '',
        });
      }
    }

    if (item.type === 'handover_create' && (!projectId || item.payload.projectId === projectId) && Array.isArray(item.payload.proofPhotos)) {
      const proofPhotos = item.payload.proofPhotos as ProofPhoto[];
      const uploadedCount = Array.isArray(item.payload.proofFileIds) ? item.payload.proofFileIds.length : 0;
      proofPhotos.slice(uploadedCount).forEach((photo) => {
        if (typeof photo.uri === 'string') {
          photos.push({
            queueId: item.id,
            uri: photo.uri,
            fileName: typeof photo.fileName === 'string' ? photo.fileName : '',
          });
        }
      });
    }
  }

  if (photos.length === 0) return null;

  async function retry(queueId: string) {
    setRetryingId(queueId);
    try {
      await retryQueuedAction(queueId);
    } finally {
      setRetryingId((current) => current === queueId ? null : current);
    }
  }

  return (
    <>
      <Text style={styles.heading}>{t('project.pendingPhotos')}</Text>
      {photos.map((photo, index) => (
        <Card key={`${photo.queueId}-${photo.uri}-${index}`} style={styles.card}>
          <Image source={{ uri: photo.uri }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.info}>
            {photo.fileName ? <Text style={font.bodyStrong} numberOfLines={1}>{photo.fileName}</Text> : null}
            <Text style={styles.pending} accessibilityRole="text">{t('common.waitingToUpload')}</Text>
            <View style={styles.button}>
              <Button
                label={t('common.retryUpload')}
                icon="cloud-upload-outline"
                variant="secondary"
                block={false}
                loading={retryingId === photo.queueId}
                onPress={() => void retry(photo.queueId)}
              />
            </View>
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { ...font.h2, marginTop: spacing.xl, marginBottom: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  thumbnail: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  info: { flex: 1, gap: spacing.xs },
  pending: { ...font.caption, color: colors.warning, fontWeight: '700' },
  button: { alignSelf: 'flex-start', marginTop: spacing.xs },
});
