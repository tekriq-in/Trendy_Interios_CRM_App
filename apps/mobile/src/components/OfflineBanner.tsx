import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import type { RootState } from '../store';
import { colors } from '../theme';

/**
 * Shows connection state, how many changes are waiting to upload, and, in red,
 * any that could not be uploaded (those are kept, see Profile to retry or
 * discard them). Staff work in factories and on sites with patchy signal, so
 * they need to see clearly that their update was saved. Rendered under every
 * screen header, so it needs no wiring in individual screens.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const net = useNetInfo();
  const queue = useSelector((s: RootState) => s.offlineQueue.queue);
  const pending = queue.filter((q) => !q.failed).length;
  const failed = queue.length - pending;
  // `isConnected` is null until the first reading; treat unknown as online.
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline && pending === 0 && failed === 0) return null;

  const kind = failed > 0 ? 'failed' : offline ? 'offline' : 'syncing';
  const view = {
    failed: { bg: colors.dangerSoft, fg: colors.danger, icon: 'alert-circle' as const, text: t('common.failedSync', { count: failed }) },
    offline: { bg: colors.warningSoft, fg: colors.warning, icon: 'cloud-offline-outline' as const, text: t('common.offlineBanner') },
    syncing: { bg: colors.infoSoft, fg: colors.info, icon: 'sync-outline' as const, text: t('common.pendingSync', { count: pending }) },
  }[kind];

  return (
    <View style={[styles.bar, { backgroundColor: view.bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name={view.icon} size={18} color={view.fg} />
      <Text style={[styles.text, { color: view.fg }]}>{view.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  text: { flex: 1, fontSize: 13, fontWeight: '700' },
});
