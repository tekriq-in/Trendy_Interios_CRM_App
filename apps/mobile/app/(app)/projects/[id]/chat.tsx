import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { fetchGroups } from '../../../../src/services/chat.service';
import { EmptyState, ErrorState, ScreenHeader } from '../../../../src/components/ui';
import { colors } from '../../../../src/theme';

/**
 * Opens the chat that belongs to this project. It is a redirect, so it only
 * ever shows a spinner, or, when something is wrong, says what and offers a way out.
 */
export default function ProjectChatRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const [state, setState] = useState<'loading' | 'missing' | 'error'>('loading');

  const open = useCallback(async () => {
    setState('loading');
    try {
      const groups = await fetchGroups();
      const group = groups.find((g) => g.type === 'project' && (g.projectRef?._id === id || g.channel === `project:${id}`));
      if (!group) {
        setState('missing');
        return;
      }
      router.replace({
        pathname: '/(app)/chat/[groupId]',
        params: { groupId: group._id, channel: group.channel, name: group.name, type: group.type },
      });
    } catch {
      setState('error');
    }
  }, [id, router]);

  useEffect(() => {
    void open();
  }, [open]);

  return (
    <View style={styles.root}>
      <ScreenHeader title={t('chat.title')} back />
      {state === 'loading' ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={colors.primary} />
      ) : state === 'missing' ? (
        <EmptyState icon="chatbubbles-outline" title={t('chat.noProjectChat')} message={t('chat.noProjectChatMessage')} />
      ) : (
        <ErrorState title={t('common.couldNotLoad')} message={t('common.checkConnection')} retryLabel={t('common.retry')} onRetry={() => void open()} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
