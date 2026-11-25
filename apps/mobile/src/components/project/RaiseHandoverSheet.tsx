import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api, describeApiError } from '../../services/api';
import { uploadProjectPhoto } from '../../services/uploads';
import { pickPhoto, type PhotoSource, type PickedPhoto } from '../../utils/photo';
import { Button, Sheet, TextField } from '../ui';
import { colors, font, radius, spacing } from '../../theme';
import type { StageDept } from './StageStepper';

const MAX_PHOTOS = 4;

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  from: StageDept;
  to: StageDept;
  onRaised: () => void;
}

/**
 * Raise a handover to the next department. The SOW and the API both require
 * photo proof, so the submit button stays disabled until there is at least one.
 * The camera is the main path because the worker is standing at the finished work.
 */
export function RaiseHandoverSheet({ visible, onClose, projectId, from, to, onRaised }: Props) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setPhotos([]);
      setNotes('');
      setError('');
    }
  }, [visible]);

  async function add(source: PhotoSource) {
    setError('');
    const result = await pickPhoto(source);
    if (result.status === 'denied') setError(t('handover.cameraDenied'));
    else if (result.status === 'ok') setPhotos((p) => [...p, result.photo].slice(0, MAX_PHOTOS));
  }

  async function submit() {
    if (photos.length === 0) {
      setError(t('handover.proofRequired'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      // 1. Upload the proof photos, 2. raise the handover pointing at them.
      const proofFileIds: string[] = [];
      for (const photo of photos) {
        proofFileIds.push(await uploadProjectPhoto(photo, projectId, from._id));
      }
      await api.post('/handovers', {
        projectId,
        fromDepartmentId: from._id,
        toDepartmentId: to._id,
        proofFileIds,
        notes: notes.trim() || undefined,
      });
      onRaised();
      onClose();
    } catch (err) {
      const msg = describeApiError(err, t('handover.failed'));
      setError(msg === 'offline' ? t('common.checkConnection') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet visible={visible} title={t('handover.raise')} onClose={onClose}>
      <View style={styles.route}>
        <View style={styles.pill}>
          <Text style={styles.pillLabel}>{t('handover.from')}</Text>
          <Text style={styles.pillName} numberOfLines={2}>{from.name}</Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color={colors.textSubtle} />
        <View style={[styles.pill, styles.pillTo]}>
          <Text style={[styles.pillLabel, { color: colors.primary }]}>{t('handover.to')}</Text>
          <Text style={[styles.pillName, { color: colors.primary }]} numberOfLines={2}>{to.name}</Text>
        </View>
      </View>

      <Text style={styles.heading}>{t('handover.proofTitle')}</Text>
      <Text style={styles.help}>{t('handover.proofHelp')}</Text>

      {photos.length > 0 ? (
        <View style={styles.thumbs}>
          {photos.map((p, i) => (
            <View key={p.uri + i} style={styles.thumbWrap}>
              <Image source={{ uri: p.uri }} style={styles.thumb} accessibilityLabel={`Photo ${i + 1}`} />
              <Pressable
                onPress={() => setPhotos((list) => list.filter((_, idx) => idx !== i))}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${i + 1}`}
                style={styles.remove}
              >
                <Ionicons name="close" size={18} color={colors.onPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {photos.length < MAX_PHOTOS ? (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <Button label={t('handover.takePhoto')} icon="camera" onPress={() => add('camera')} disabled={submitting} />
          </View>
          <View style={styles.flex}>
            <Button label={t('handover.fromGallery')} icon="images" variant="secondary" onPress={() => add('library')} disabled={submitting} />
          </View>
        </View>
      ) : null}

      <View style={{ height: spacing.lg }} />
      <TextField label={`${t('handover.notes')} (${t('common.optional')})`} value={notes} onChangeText={setNotes} multiline />

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      <Button
        label={t('handover.submit')}
        icon="swap-horizontal"
        onPress={submit}
        loading={submitting}
        disabled={photos.length === 0}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  pill: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  pillTo: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  pillLabel: { fontSize: 11, fontWeight: '800', color: colors.textSubtle, letterSpacing: 0.8, textTransform: 'uppercase' },
  pillName: { ...font.bodyStrong, marginTop: 2 },
  heading: { ...font.h3 },
  help: { ...font.caption, marginTop: 2, marginBottom: spacing.md },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  thumbWrap: { width: 84, height: 84 },
  thumb: { width: 84, height: 84, borderRadius: radius.md, backgroundColor: colors.neutralSoft },
  remove: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
