import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../ui';
import { colors, font, handoverStatusTone, spacing } from '../../theme';

export interface HandoverRow {
  _id: string;
  status: string;
  notes?: string;
  rejectionReason?: string;
  fromDepartment?: { name?: string };
  toDepartment?: { name?: string };
  raisedBy?: { name?: string };
  proofFiles?: unknown[];
  createdAt?: string;
}

interface HandoverItemProps {
  handover: HandoverRow;
  canConfirm: boolean;
  canAccept: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * A handover and what the viewer can do with it, following the SOW flow:
 * employee raises, their lead confirms, the receiving lead accepts or rejects
 * (with a reason). Buttons only appear when the viewer's role allows them AND
 * the handover is in the matching state.
 */
export function HandoverItem({ handover, canConfirm, canAccept, busy = false, onConfirm, onAccept, onReject }: HandoverItemProps) {
  const { t } = useTranslation();
  const proofs = handover.proofFiles?.length ?? 0;

  return (
    <Card style={styles.card}>
      <View style={styles.route}>
        <Text style={styles.dept} numberOfLines={1}>
          {handover.fromDepartment?.name ?? '?'}
        </Text>
        <Ionicons name="arrow-forward" size={18} color={colors.textSubtle} />
        <Text style={styles.dept} numberOfLines={1}>
          {handover.toDepartment?.name ?? '?'}
        </Text>
      </View>

      <View style={styles.badgeRow}>
        <Badge label={t(`handover.${handover.status}`, { defaultValue: handover.status })} tone={handoverStatusTone[handover.status] ?? 'neutral'} />
        {proofs > 0 ? (
          <View style={styles.proof}>
            <Ionicons name="images-outline" size={16} color={colors.textSubtle} />
            <Text style={font.caption}>{proofs}</Text>
          </View>
        ) : null}
      </View>

      {handover.raisedBy?.name ? <Text style={styles.meta}>{handover.raisedBy.name}</Text> : null}
      {handover.notes ? <Text style={styles.notes}>{handover.notes}</Text> : null}
      {handover.status === 'rejected' && handover.rejectionReason ? (
        <Text style={styles.rejected}>{handover.rejectionReason}</Text>
      ) : null}

      {handover.status === 'draft' && canConfirm ? (
        <View style={styles.actions}>
          <Button label={t('handover.confirm')} icon="checkmark" onPress={onConfirm} loading={busy} />
        </View>
      ) : null}
      {handover.status === 'confirmed' && canAccept ? (
        <View style={styles.actionsRow}>
          <View style={styles.flex}>
            <Button label={t('handover.reject')} variant="secondary" onPress={onReject} disabled={busy} />
          </View>
          <View style={styles.flex}>
            <Button label={t('handover.accept')} icon="checkmark" onPress={onAccept} loading={busy} />
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  route: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dept: { ...font.h3, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  proof: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { ...font.caption, marginTop: spacing.sm },
  notes: { ...font.body, marginTop: spacing.sm },
  rejected: { color: colors.danger, fontSize: 15, fontWeight: '600', marginTop: spacing.sm },
  actions: { marginTop: spacing.md },
  actionsRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  flex: { flex: 1 },
});
