import { ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useRef } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../theme';

export interface StageDept {
  _id: string;
  name: string;
  order: number;
}

/**
 * The project's journey through the departments (Enquiry to Handover).
 * Done stages get a tick, the current one is highlighted and scrolled into
 * view, upcoming ones are muted. The stage list is data-driven (SOW), so this
 * renders whatever departments the API returns, not a fixed eight.
 */
export function StageStepper({ stages, currentId }: { stages: StageDept[]; currentId: string }) {
  const scroll = useRef<ScrollViewInstance>(null);
  const currentIdx = stages.findIndex((s) => s._id === currentId);

  return (
    <ScrollView
      ref={scroll}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Project stages"
    >
      {stages.map((stage, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const current = i === currentIdx;
        return (
          <View
            key={stage._id}
            style={styles.step}
            onLayout={(e) => {
              if (current) scroll.current?.scrollTo({ x: Math.max(0, e.nativeEvent.layout.x - 24), animated: false });
            }}
            accessible
            accessibilityLabel={`${stage.order}. ${stage.name}${current ? ', current' : done ? ', done' : ''}`}
          >
            <View style={styles.lineRow}>
              <View style={[styles.line, i === 0 && styles.hidden, (done || current) && styles.lineOn]} />
              <View style={[styles.dot, done && styles.dotDone, current && styles.dotCurrent]}>
                {done ? (
                  <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.num, current && styles.numCurrent]}>{stage.order}</Text>
                )}
              </View>
              <View style={[styles.line, i === stages.length - 1 && styles.hidden, done && styles.lineOn]} />
            </View>
            <Text style={[styles.name, current && styles.nameCurrent]} numberOfLines={2}>
              {stage.name}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingVertical: 4, paddingHorizontal: 4 },
  step: { width: 92, alignItems: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  line: { flex: 1, height: 3, backgroundColor: colors.neutralSoft },
  lineOn: { backgroundColor: colors.primary },
  hidden: { opacity: 0 },
  dot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.neutralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.primary },
  dotCurrent: { backgroundColor: colors.primary, borderWidth: 4, borderColor: colors.primarySoft, width: 42, height: 42, borderRadius: 21 },
  num: { fontSize: 14, fontWeight: '800', color: colors.textSubtle },
  numCurrent: { color: colors.onPrimary },
  name: { ...font.caption, textAlign: 'center', marginTop: 6, paddingHorizontal: 2 },
  nameCurrent: { color: colors.primary, fontWeight: '800' },
});
