import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ChatGroup, ChatGroupType } from '@ti/shared';
import { Avatar } from '../ui';
import { colors, font, size, spacing } from '../../theme';
import { relativeTime } from '../../utils/format';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TYPE_ICON: Record<ChatGroupType, IconName | undefined> = {
  individual: undefined, // direct messages show the person's initials
  project: 'albums',
  department: 'business',
  custom: 'people',
};

const TYPE_COLOR: Record<ChatGroupType, string | undefined> = {
  individual: undefined,
  project: '#0E7490',
  department: '#047857',
  custom: '#B45309',
};

export const conversationName = (g: ChatGroup): string =>
  g.type === 'individual' ? (g.displayName ?? g.name) : g.name;

/** One conversation in the list: avatar, name, last message, time and unread count. */
export function ConversationRow({ group, unread, onPress }: { group: ChatGroup; unread: number; onPress: () => void }) {
  const { t } = useTranslation();
  const name = conversationName(group);
  const preview = group.lastMessage
    ? `${group.lastMessage.senderName}: ${group.lastMessage.body}`
    : group.members.length > 1
      ? t('chat.members', { count: group.members.length })
      : t('chat.directMessage');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}${unread > 0 ? `, ${t('chat.unread', { count: unread })}` : ''}`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Avatar name={name} icon={TYPE_ICON[group.type]} color={TYPE_COLOR[group.type]} />
      <View style={styles.mid}>
        <Text style={[styles.name, unread > 0 && styles.unreadText]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.preview, unread > 0 && styles.unreadPreview]} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={styles.time}>{relativeTime(group.lastMessage?.createdAt ?? group.updatedAt, t)}</Text>
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  mid: { flex: 1, minHeight: size.minTap, justifyContent: 'center' },
  name: { ...font.bodyStrong },
  unreadText: { fontWeight: '800' },
  preview: { ...font.caption, fontSize: 14, marginTop: 2 },
  unreadPreview: { color: colors.text, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 6 },
  time: { ...font.caption },
  badge: { backgroundColor: colors.primary, borderRadius: 11, minWidth: 22, height: 22, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: colors.onPrimary, fontSize: 12, fontWeight: '800' },
});
