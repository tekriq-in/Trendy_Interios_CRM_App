import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetchGroups } from '../../../../src/services/chat.service';

export default function ProjectChatRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  useEffect(() => {
    fetchGroups()
      .then((groups) => {
        const group = groups.find(
          (g) => g.type === 'project' && (g.projectRef?._id === id || g.channel === `project:${id}`),
        );
        if (group) {
          router.replace({
            pathname: '/(app)/chat/[groupId]',
            params: { groupId: group._id, channel: group.channel, name: group.name, type: group.type },
          });
        } else {
          // No project group found yet — go back
          router.back();
        }
      })
      .catch(() => router.back());
  }, [id]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4F46E5" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
});
