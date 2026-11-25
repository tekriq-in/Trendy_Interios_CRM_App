import { StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';
import { initials } from '../../utils/format';

// Distinct, readable background colours; the same name always gets the same one.
const PALETTE = ['#4F46E5', '#0E7490', '#047857', '#B45309', '#9333EA', '#BE185D', '#1D4ED8', '#B91C1C'];

function hash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

interface AvatarProps {
  /** Person's or group's name: used for the initials and a stable colour. */
  name?: string;
  /** Show an icon instead of initials (project, department and team chats). */
  icon?: ComponentProps<typeof Ionicons>['name'];
  /** Override the colour. */
  color?: string;
  size?: number;
}

export function Avatar({ name = '', icon, color, size = 48 }: AvatarProps) {
  const bg = color ?? PALETTE[hash(name) % PALETTE.length];
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {icon ? (
        <Ionicons name={icon} size={size * 0.46} color={colors.onPrimary} />
      ) : (
        <Text style={[styles.text, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  text: { color: colors.onPrimary, fontWeight: '800' },
});
