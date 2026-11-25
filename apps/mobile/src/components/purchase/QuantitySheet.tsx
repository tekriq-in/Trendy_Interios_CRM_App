import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../services/api';
import { Button, Chip, Sheet } from '../ui';
import { colors, font, radius, spacing } from '../../theme';
import { fmtQty, purchaseErrorKey, type PurchaseItem } from './purchase-shared';

interface Props {
  item: PurchaseItem | null;
  mode: 'ordered' | 'received';
  onClose: () => void;
  onSaved: (updated: PurchaseItem) => void;
}

/**
 * "How many are ordered / received?" The number is changed with big minus and
 * plus buttons (or one tap on "All"), so nobody has to type on site. The limits
 * mirror the API: received cannot pass the order qty, and ordered cannot drop
 * below what has already been received.
 */
export function QuantitySheet({ item, mode, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [value, setValue] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setValue(fmtQty(mode === 'ordered' ? item.orderedQty : item.receivedQty));
      setError('');
    }
  }, [item, mode]);

  if (!item) return <Sheet visible={false} title="" onClose={onClose}>{null}</Sheet>;

  const min = mode === 'ordered' ? item.receivedQty : 0;
  const max = item.quantity;
  const num = Number(value);
  const step = (delta: number) => {
    const base = Number.isNaN(num) ? min : num;
    setValue(fmtQty(Math.min(max, Math.max(min, base + delta))));
    setError('');
  };

  async function save() {
    if (value.trim() === '' || Number.isNaN(num) || num < min || num > max) {
      setError(t('purchase.invalidQty', { min: fmtQty(min), max: fmtQty(max) }));
      return;
    }
    setSaving(true);
    try {
      const body = mode === 'ordered' ? { orderedQty: num } : { receivedQty: num };
      const res = await api.patch<PurchaseItem>(`/purchase-items/${item!._id}/progress`, body);
      onSaved(res.data);
      onClose();
    } catch (err) {
      const key = purchaseErrorKey(err);
      setError(key ? t(key) : t('purchase.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible onClose={onClose} title={mode === 'ordered' ? t('purchase.howOrdered') : t('purchase.howReceived')}>
      <Text style={styles.name}>#{item.slNo}  {item.item}</Text>
      <Text style={font.caption}>{t('purchase.range', { min: fmtQty(min), max: fmtQty(max) })}</Text>

      <View style={styles.stepper}>
        <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="−" style={styles.stepBtn}>
          <Ionicons name="remove" size={32} color={colors.primary} />
        </Pressable>
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v.replace(/[^0-9.]/g, ''));
            setError('');
          }}
          keyboardType="decimal-pad"
          selectTextOnFocus
          style={styles.value}
          accessibilityLabel={mode === 'ordered' ? t('purchase.qOrdered') : t('purchase.qReceived')}
        />
        <Pressable onPress={() => step(1)} accessibilityRole="button" accessibilityLabel="+" style={styles.stepBtn}>
          <Ionicons name="add" size={32} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.quick}>
        <Chip label={t('purchase.setAll', { n: fmtQty(max) })} selected={num === max} onPress={() => setValue(fmtQty(max))} />
      </View>

      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
      <Button label={t('common.save')} icon="checkmark" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  name: { ...font.h3, marginBottom: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginVertical: spacing.xl },
  stepBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  value: { minWidth: 110, textAlign: 'center', fontSize: 40, fontWeight: '800', color: colors.text, borderBottomWidth: 2, borderBottomColor: colors.borderStrong, paddingVertical: 4 },
  quick: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
