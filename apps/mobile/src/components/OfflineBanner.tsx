import { StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNetInfo } from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import type { RootState } from '../store';
import { colors } from '../theme';

/**
 * Shows connection state and how many queued changes are waiting to sync.
 * Staff work in factories and on sites with patchy signal, so they need to see
 * clearly that their update was saved and will upload later. Rendered under
 * every screen header, so it needs no wiring in individual screens.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const net = useNetInfo();
  const pending = useSelector((s: RootState) => s.offlineQueue.queue.length);
  // `isConnected` is null until the first reading; treat unknown as online.
  const offline = net.isConnected === false || net.isInternetReachable === false;
  if (!offline && pending === 0) return null;

  return (
    <View
      style={[styles.bar, offline ? styles.offline : styles.syncing]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Ionicons
        name={offline ? 'cloud-offline-outline' : 'sync-outline'}
        size={18}
        color={offline ? colors.warning : colors.info}
      />
      <Text style={[styles.text, { color: offline ? colors.warning : colors.info }]}>
        {offline ? t('common.offlineBanner') : t('common.pendingSync', { count: pending })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  offline: { backgroundColor: colors.warningSoft },
  syncing: { backgroundColor: colors.infoSoft },
  text: { flex: 1, fontSize: 13, fontWeight: '700' },
});
