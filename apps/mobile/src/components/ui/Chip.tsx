import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, size } from '../../theme';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
}

/** Selectable filter or option. 48dp tall so it is as easy to tap as a button. */
export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.text, selected && styles.selectedText]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: size.minTap,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
  text: { fontSize: 15, fontWeight: '600', color: colors.textMuted },
  selectedText: { color: colors.onPrimary },
});
