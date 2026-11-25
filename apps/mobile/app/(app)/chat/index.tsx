import { RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { ChatGroup, ChatGroupType } from '@ti/shared';
import { useSocket } from '../../../src/context/socket.context';
import { fetchGroups } from '../../../src/services/chat.service';
import type { RootState } from '../../../src/store';
import { ConversationRow, conversationName } from '../../../src/components/chat/ConversationRow';
import { NewChatModal } from '../../../src/components/chat/NewChatModal';
import { EmptyState, ErrorState, HeaderIconButton, ScreenHeader } from '../../../src/components/ui';
import { colors, font, radius, size, spacing } from '../../../src/theme';

const ORDER: ChatGroupType[] = ['individual', 'project', 'custom', 'department'];
const SECTION_KEY: Record<ChatGroupType, string> = {
  individual: 'chat.sectionDirect',
  project: 'chat.sectionProjects',
  custom: 'chat.sectionTeams',
  department: 'chat.sectionDepartments',
};

export default function ChatListScreen() {
  const { t } = useTranslation();
  const userId = useSelector((s: RootState) => s.auth.userId) ?? '';
  const { unreadMap } = useSocket();

  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      setGroups(await fetchGroups());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ORDER.map((type) => ({
      type,
      title: t(SECTION_KEY[type]),
      data: groups.filter((g) => g.type === type && (!q || conversationName(g).toLowerCase().includes(q))),
    })).filter((s) => s.data.length > 0);
  }, [groups, query, t]);

  const totalUnread = Object.values(unreadMap).reduce((a, b) => a + b, 0);

  function open(group: ChatGroup) {
    router.push({
      pathname: '/(app)/chat/[groupId]',
      params: { groupId: group._id, channel: group.channel, name: conversationName(group), type: group.type },
    });
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title={t('chat.title')}
        subtitle={totalUnread > 0 ? t('chat.unread', { count: totalUnread }) : undefined}
        right={<HeaderIconButton icon="create-outline" label={t('chat.newChat')} onPress={() => setShowNew(true)} />}
      />

      {loading ? null : failed && groups.length === 0 ? (
        <ErrorState
          title={t('common.couldNotLoad')}
          message={`${t('common.checkConnection')}\n${t('common.serverWaking')}`}
          retryLabel={t('common.retry')}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(g) => g._id}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ paddingBottom: 32 }}
          ListHeaderComponent={
            groups.length > 0 ? (
              <View style={styles.search}>
                <Ionicons name="search" size={20} color={colors.textSubtle} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('chat.searchPlaceholder')}
                  placeholderTextColor={colors.placeholder}
                  style={styles.searchInput}
                  accessibilityLabel={t('common.search')}
                  autoCorrect={false}
                />
              </View>
            ) : undefined
          }
          ListEmptyComponent={
            groups.length === 0 ? (
              <EmptyState
                icon="chatbubbles-outline"
                title={t('chat.noConversations')}
                message={t('chat.noConversationsMessage')}
                actionLabel={t('chat.startChat')}
                onAction={() => setShowNew(true)}
              />
            ) : (
              <EmptyState icon="search-outline" title={t('chat.noResults')} />
            )
          }
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }) => <ConversationRow group={item} unread={unreadMap[item.channel] ?? 0} onPress={() => open(item)} />}
        />
      )}

      <NewChatModal
        visible={showNew}
        onClose={() => {
          setShowNew(false);
          void load();
        }}
        currentUserId={userId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.control,
    margin: spacing.lg,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, minHeight: size.control },
  sectionTitle: { ...font.caption, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: 6 },
});
