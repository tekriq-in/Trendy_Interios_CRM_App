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
  /** Fixed project (when opened from a project screen). Omit it to let the user pick one. */
  projectId?: string;
  /** Projects to choose from when `projectId` is not given. */
  projects?: { _id: string; title: string }[];
  onRaised: () => void;
}

/**
 * Any team can raise a blocker (SOW). It goes to the team lead and the MD/admin
 * dashboard; escalation stays manual, so nothing here triggers an SLA.
 */
// A stable default: an inline `= []` is a new array every render, which would re-run the
// reset effect below on each keystroke and wipe what the user is typing.
const NO_PROJECTS: { _id: string; title: string }[] = [];

export function RaiseBlockerSheet({ visible, onClose, projectId, projects = NO_PROJECTS, onRaised }: Props) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<BlockerType>('internal');
  const [picked, setPicked] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDescription('');
      setType('internal');
      setError('');
      setPicked(projects.length === 1 ? projects[0]._id : '');
    }
  }, [visible, projects]);

  async function submit() {
    const targetId = projectId ?? picked;
    if (!targetId) {
      setError(t('tasks.pickProject'));
      return;
    }
    // The API requires 5 to 200 characters; check here so the message is instant and translated.
    if (title.trim().length < 5) {
      setError(t('blocker.titleMin'));
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/blockers', {
        projectId: targetId,
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
      {!projectId ? (
        <>
          <Text style={styles.label}>{t('blockers.pickProject')}</Text>
          <View style={styles.chips}>
            {projects.map((p) => (
              <Chip key={p._id} label={p.title} selected={picked === p._id} onPress={() => setPicked(p._id)} />
            ))}
          </View>
        </>
      ) : null}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
