import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function AllTasksScreen() {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>{t('tasks')}</Text>
      <Text style={styles.hint}>Select a project to view its tasks.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6', padding: 24, paddingTop: 56 },
  heading: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 8 },
  hint: { color: '#6B7280', fontSize: 15 },
});
