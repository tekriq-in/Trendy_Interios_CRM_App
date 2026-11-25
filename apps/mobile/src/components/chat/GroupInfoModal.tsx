import { Alert, FlatList, Modal, StyleSheet, Text, View } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatGroupType } from '@ti/shared';
import { addMember, fetchUsers, removeMember } from '../../services/chat.service';
import { Avatar, Badge, Button, Card, HeaderIconButton, ScreenHeader } from '../ui';
import { colors, font, spacing } from '../../theme';

interface Person {
  _id: string;
  name: string;
  email: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupType: ChatGroupType;
  members: Person[];
  currentUserId: string;
  /** Called after the user leaves the group, so the screen can navigate away. */
  onLeft: () => void;
  /** Called after a member was added, so the screen can refresh the member list. */
  onChanged: () => void;
}

/**
 * Who is in this conversation. Only custom groups can be changed: project and
 * department chats are auto-created from the org structure, and DMs have two
 * fixed people.
 */
export function GroupInfoModal({ visible, onClose, groupId, groupName, groupType, members, currentUserId, onLeft, onChanged }: Props) {
  const { t } = useTranslation();
  const isCustom = groupType === 'custom';
  const [everyone, setEveryone] = useState<Person[]>([]);
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setAdding(false);
      return;
    }
    if (isCustom) fetchUsers().then(setEveryone).catch(() => {});
  }, [visible, isCustom]);

  const candidates = useMemo(
    () => everyone.filter((u) => u._id !== currentUserId && !members.some((m) => m._id === u._id)),
    [everyone, members, currentUserId],
  );

  async function add(userId: string) {
    setBusyId(userId);
    try {
      await addMember(groupId, userId);
      onChanged();
    } catch {
      // The list simply does not change; the user can try again.
    } finally {
      setBusyId(null);
    }
  }

  function leave() {
    Alert.alert(t('chat.leaveTitle'), t('chat.leaveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('chat.leaveGroup'),
        style: 'destructive',
        onPress: async () => {
          await removeMember(groupId, currentUserId).catch(() => {});
          onClose();
          onLeft();
        },
      },
    ]);
  }

  const list = adding ? candidates : members;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.root}>
        <ScreenHeader
          title={groupName}
          subtitle={t('chat.members', { count: members.length })}
          right={<HeaderIconButton icon="close" label={t('common.close')} onPress={onClose} />}
        />
        <FlatList
          data={list}
          keyExtractor={(p) => p._id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.top}>
              <Badge label={groupType} tone="primary" />
              <Text style={styles.section}>{adding ? t('chat.addMember') : t('chat.membersTitle')}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.person} onPress={adding ? () => void add(item._id) : undefined} accessibilityLabel={item.name}>
              <Avatar name={item.name} size={44} />
              <View style={styles.flex}>
                <Text style={font.bodyStrong}>
                  {item.name}
                  {item._id === currentUserId ? ` (${t('chat.you')})` : ''}
                </Text>
                <Text style={font.caption}>{item.email}</Text>
              </View>
              {busyId === item._id ? <Text style={font.caption}>…</Text> : null}
            </Card>
          )}
          ListFooterComponent={
            isCustom ? (
              <View style={styles.actions}>
                <Button
                  label={adding ? t('common.close') : t('chat.addMember')}
                  icon={adding ? 'close' : 'person-add'}
                  variant="secondary"
                  onPress={() => setAdding((v) => !v)}
                />
                <Button label={t('chat.leaveGroup')} icon="exit-outline" variant="danger" onPress={leave} />
              </View>
            ) : undefined
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, paddingBottom: 40 },
  top: { gap: spacing.sm, marginBottom: spacing.md },
  section: { ...font.h3, marginTop: spacing.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  actions: { gap: spacing.md, marginTop: spacing.lg },
});
