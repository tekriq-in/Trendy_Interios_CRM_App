import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, toneColors, type Tone } from '../../theme';

interface ProgressBarProps {
  /** 0 to 100. Values outside the range are clamped. */
  value: number;
  tone?: Tone;
  showLabel?: boolean;
  height?: number;
}

/** The "project readiness bar" from the SOW. */
export function ProgressBar({ value, tone = 'primary', showLabel = true, height = 8 }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
  const fill = pct >= 100 ? toneColors.success.fg : toneColors[tone].fg;
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.track, { height, borderRadius: height / 2 }]}>
        <View style={{ width: `${pct}%`, height, borderRadius: height / 2, backgroundColor: fill }} />
      </View>
      {showLabel ? <Text style={styles.label}>{pct}%</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, backgroundColor: colors.neutralSoft, overflow: 'hidden', borderRadius: radius.pill },
  label: { ...font.label, minWidth: 40, textAlign: 'right' },
});
