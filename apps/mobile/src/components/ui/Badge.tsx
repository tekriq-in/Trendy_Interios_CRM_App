import { StyleSheet, Text, View } from 'react-native';
import { radius, toneColors, type Tone } from '../../theme';

/** Small coloured pill for a status. Always paired with text, never colour alone. */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = toneColors[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.2 },
});
