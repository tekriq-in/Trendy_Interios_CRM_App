import { StyleSheet, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, describeApiError } from '../../services/api';
import { Button, Chip, Sheet, TextField } from '../ui';
import { colors, font, radius, spacing } from '../../theme';

type BlockerType = 'internal' | 'client_side';

interface Props {
  visible: boolean;
  onClose: () => void;
  projectId: string;
  onRaised: () => void;
}

/**
 * Any team can raise a blocker (SOW). It goes to the team lead and the MD/admin
 * dashboard; escalation stays manual, so nothing here triggers an SLA.
 */
export function RaiseBlockerSheet({ visible, onClose, projectId, onRaised }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<BlockerType>('internal');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setType('internal');
      setError('');
    }
  }, [visible]);

  async function submit() {
    // The API requires 5 to 200 characters; check here so the message is instant and translated.
    if (title.trim().length < 5) {
      setError(t('blocker.titleMin'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/blockers', {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        type,
      });
      onRaised();
      onClose();
    } catch (err) {
      const msg = describeApiError(err, t('blocker.failed'));
      setError(msg === 'offline' ? t('common.checkConnection') : msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet visible={visible} title={t('blocker.raise')} onClose={onClose}>
      <TextField label={t('blocker.title')} value={title} onChangeText={setTitle} maxLength={200} />
      <TextField
        label={`${t('blocker.description')} (${t('common.optional')})`}
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={2000}
      />

      <Text style={styles.label}>{t('blocker.type')}</Text>
      <View style={styles.chips}>
        <Chip label={t('blocker.internal')} selected={type === 'internal'} onPress={() => setType('internal')} />
        <Chip label={t('blocker.clientSide')} selected={type === 'client_side'} onPress={() => setType('client_side')} />
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label={t('blocker.submit')} icon="warning" onPress={submit} loading={submitting} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  label: { ...font.label, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
