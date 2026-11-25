import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../../src/services/api';
import { clearAuth } from '../../../src/store/slices/auth.slice';
import { discardFailed, retryFailed } from '../../../src/store/slices/offline-queue.slice';
import { syncOfflineQueue } from '../../../src/services/sync.service';
import { setLanguage, type Language } from '../../../src/store/slices/ui.slice';
import type { RootState } from '../../../src/store';
import { useCurrentUser } from '../../../src/hooks/useCurrentUser';
import { Button, Card, Chip, ScreenHeader } from '../../../src/components/ui';
import { colors, font, spacing } from '../../../src/theme';

function initials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'TI'
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const user = useCurrentUser();
  const refreshToken = useSelector((s: RootState) => s.auth.refreshToken);
  const language = useSelector((s: RootState) => s.ui.language);
  const queue = useSelector((s: RootState) => s.offlineQueue.queue);
  const failedCount = queue.filter((q) => q.failed).length;
  const pending = queue.length - failedCount;

  async function signOut() {
    // Best effort: revoke the refresh token on the server, but always sign out locally.
    if (refreshToken) await api.post('/auth/logout', { refreshToken }).catch(() => {});
    dispatch(clearAuth());
    router.replace('/login');
  }

  function confirmSignOut() {
    Alert.alert(t('profile.signOutConfirmTitle'), t('profile.signOutConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  function confirmDiscard() {
    Alert.alert(t('common.discardTitle'), t('common.discardMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.discardUpload'), style: 'destructive', onPress: () => dispatch(discardFailed()) },
    ]);
  }

  function retryUploads() {
    dispatch(retryFailed());
    void syncOfflineQueue();
  }

  const name = user?.name || 'Staff';
  const pick = (lng: Language) => dispatch(setLanguage(lng));

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('profile.title')} />
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(name)}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {user?.role ? <Text style={styles.meta}>{user.role}</Text> : null}
            {user?.departmentName ? <Text style={styles.meta}>{user.departmentName}</Text> : null}
            {user?.email ? (
              <Text style={styles.meta} numberOfLines={1}>
                {user.email}
              </Text>
            ) : null}
          </View>
        </Card>

        <Text style={styles.section}>{t('profile.language')}</Text>
        <View style={styles.row}>
          <Chip label={t('profile.english')} selected={language === 'en'} onPress={() => pick('en')} />
          <Chip label={t('profile.tamil')} selected={language === 'ta'} onPress={() => pick('ta')} />
        </View>

        <Text style={styles.section}>{t('profile.sync')}</Text>
        <Card style={styles.syncCard}>
          <Ionicons
            name={failedCount > 0 ? 'alert-circle' : pending === 0 ? 'checkmark-circle' : 'sync'}
            size={26}
            color={failedCount > 0 ? colors.danger : pending === 0 ? colors.success : colors.info}
          />
          <Text style={styles.syncText}>
            {failedCount > 0
              ? t('common.failedSync', { count: failedCount })
              : pending === 0
                ? t('profile.allSynced')
                : t('common.pendingSync', { count: pending })}
          </Text>
        </Card>
        {failedCount > 0 ? (
          <View style={styles.failedActions}>
            <View style={styles.flex}>
              <Button label={t('common.discardUpload')} variant="secondary" onPress={confirmDiscard} />
            </View>
            <View style={styles.flex}>
              <Button label={t('common.retryUpload')} icon="refresh" onPress={retryUploads} />
            </View>
          </View>
        ) : null}

        <View style={{ height: spacing.xl }} />
        <Button label={t('profile.signOut')} icon="log-out-outline" variant="danger" onPress={confirmSignOut} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 40 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.onPrimary, fontSize: 22, fontWeight: '800' },
  name: { ...font.h2 },
  meta: { ...font.caption, marginTop: 2 },
  section: { ...font.h3, marginTop: spacing.xl, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  syncCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  syncText: { ...font.bodyStrong, flex: 1 },
  failedActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
});
