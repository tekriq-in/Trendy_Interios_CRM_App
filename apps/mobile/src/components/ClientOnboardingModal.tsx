import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api, describeApiError } from '../services/api';
import { Button, Chip, ScreenHeader, TextField } from './ui';
import { colors, font, radius, spacing } from '../theme';

interface Dept {
  _id: string;
  name: string;
  order: number;
}

const LEAD_SOURCES = ['walkin', 'referral', 'marketing', 'other'] as const;

const EMPTY = { name: '', phone: '', email: '', address: '', leadSource: 'walkin' as string, notes: '', whatsappOptIn: true };

/**
 * Two-step flow: save the client, then start their first project. Kept from the
 * original screen (same API calls) but rebuilt from the shared UI kit.
 */
export function ClientOnboardingModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<'client' | 'project'>('client');
  const [form, setForm] = useState({ ...EMPTY });
  const [title, setTitle] = useState('');
  const [depts, setDepts] = useState<Dept[]>([]);
  const [firstStageId, setFirstStageId] = useState('');
  const [clientId, setClientId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Reset every time the sheet opens, and load the departments for step 2.
  useEffect(() => {
    if (!visible) return;
    setStep('client');
    setForm({ ...EMPTY });
    setTitle('');
    setClientId('');
    setError('');
    api
      .get<Dept[]>('/departments')
      .then((r) => {
        const sorted = [...r.data].sort((a, b) => a.order - b.order);
        setDepts(sorted);
        setFirstStageId(sorted[0]?._id ?? '');
      })
      .catch(() => {});
  }, [visible]);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  async function saveClient() {
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ _id: string }>('/clients', {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        leadSource: form.leadSource,
        notes: form.notes.trim() || undefined,
        whatsappOptIn: form.whatsappOptIn,
      });
      setClientId(res.data._id);
      setStep('project');
    } catch (err) {
      setError(describeApiError(err, 'Could not save the client. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  async function createProject() {
    if (!title.trim()) {
      setError('Project title is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.post<{ _id: string }>('/projects', {
        clientId,
        title: title.trim(),
        firstStageId: firstStageId || undefined,
      });
      onCreated();
      onClose();
      router.push(`/(app)/projects/${res.data._id}`);
    } catch (err) {
      setError(describeApiError(err, 'The client was saved, but the project could not be created. You can add it later.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScreenHeader
          title={step === 'client' ? t('projects.newClient') : 'Start project'}
          subtitle={step === 'client' ? 'Step 1 of 2' : 'Step 2 of 2'}
          right={<Button label={t('common.close')} variant="ghost" block={false} onPress={onClose} />}
        />
        <ScrollView style={styles.flex} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {step === 'client' ? (
            <>
              <TextField label="Full name *" value={form.name} onChangeText={(v) => set('name', v)} placeholder="e.g. Rajesh Kumar" autoCapitalize="words" />
              <TextField label="Phone *" value={form.phone} onChangeText={(v) => set('phone', v)} placeholder="+91 98765 43210" keyboardType="phone-pad" />
              <TextField label={`Email (${t('common.optional')})`} value={form.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
              <TextField label={`Address (${t('common.optional')})`} value={form.address} onChangeText={(v) => set('address', v)} />

              <Text style={styles.label}>Lead source</Text>
              <View style={styles.chips}>
                {LEAD_SOURCES.map((src) => (
                  <Chip
                    key={src}
                    label={src.charAt(0).toUpperCase() + src.slice(1)}
                    selected={form.leadSource === src}
                    onPress={() => set('leadSource', src)}
                  />
                ))}
              </View>

              <TextField label={`Notes (${t('common.optional')})`} value={form.notes} onChangeText={(v) => set('notes', v)} multiline />

              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>WhatsApp opt-in</Text>
                  <Text style={font.caption}>Client agrees to receive updates on WhatsApp</Text>
                </View>
                <Switch
                  value={form.whatsappOptIn}
                  onValueChange={(v) => set('whatsappOptIn', v)}
                  trackColor={{ true: colors.primary, false: colors.borderStrong }}
                  thumbColor="#fff"
                />
              </View>

              <Button label="Save and continue" icon="arrow-forward" onPress={saveClient} loading={saving} />
            </>
          ) : (
            <>
              <Text style={styles.success}>Client saved. Now start their first project.</Text>
              <TextField label="Project title *" value={title} onChangeText={setTitle} placeholder="e.g. Hall renovation" />
              <Text style={styles.label}>Starting department</Text>
              <View style={styles.chips}>
                {depts.map((d) => (
                  <Chip key={d._id} label={`${d.order}. ${d.name}`} selected={firstStageId === d._id} onPress={() => setFirstStageId(d._id)} />
                ))}
              </View>
              <Button label="Create project" icon="checkmark" onPress={createProject} loading={saving} disabled={!title.trim()} />
              <View style={{ height: 8 }} />
              <Button
                label="Skip, add project later"
                variant="ghost"
                onPress={() => {
                  onCreated();
                  onClose();
                }}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  form: { padding: spacing.lg, paddingBottom: 48 },
  label: { ...font.label, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.lg },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.xl },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.lg },
  success: { color: colors.success, fontSize: 15, fontWeight: '600', backgroundColor: colors.successSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.lg },
});
