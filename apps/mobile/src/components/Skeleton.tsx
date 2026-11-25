import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { colors, radius } from '../theme';

function SkeletonBox({ width, height, style }: { width: number | string; height: number; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[{ width: width as number, height, backgroundColor: colors.neutralSoft, borderRadius: 6 }, style, { opacity }]}
    />
  );
}

export function SkeletonProjectCard() {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <SkeletonBox width="70%" height={16} />
        <SkeletonBox width={48} height={20} />
      </View>
      <SkeletonBox width="40%" height={12} style={{ marginTop: 8 }} />
      <SkeletonBox width="100%" height={6} style={{ marginTop: 12, borderRadius: 3 }} />
      <View style={[s.row, { marginTop: 8 }]}>
        <SkeletonBox width={60} height={11} />
        <SkeletonBox width={40} height={11} />
      </View>
    </View>
  );
}

export function SkeletonTaskRow() {
  return (
    <View style={s.taskRow}>
      <SkeletonBox width={10} height={10} style={{ borderRadius: 5 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <SkeletonBox width="65%" height={14} />
        <SkeletonBox width="40%" height={11} />
      </View>
      <SkeletonBox width={44} height={44} style={{ borderRadius: 10 }} />
    </View>
  );
}

export function SkeletonBlockerRow() {
  return (
    <View style={s.card}>
      <View style={s.row}>
        <SkeletonBox width="60%" height={14} />
        <SkeletonBox width={56} height={20} />
      </View>
      <SkeletonBox width="80%" height={12} style={{ marginTop: 8 }} />
      <SkeletonBox width="45%" height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  taskRow: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
