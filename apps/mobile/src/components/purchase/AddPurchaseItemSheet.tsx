import { StyleSheet, Text } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { purchaseItemMatchKey } from '@ti/shared';
import { api } from '../../services/api';
import { Button, Sheet, TextField } from '../ui';
import { colors, radius, spacing } from '../../theme';
import { fmtQty, purchaseErrorKey, type PurchaseItem } from './purchase-shared';

type Form = { area: string; item: string; brand: string; code: string; size: string; finish: string; quantity: string };
const EMPTY: Form = { area: '', item: '', brand: '', code: '', size: '', finish: '', quantity: '' };

interface Props {
  visible: boolean;
  projectId: string;
  items: PurchaseItem[];
  onClose: () => void;
  onSaved: (item: PurchaseItem, merged: boolean) => void;
}

/**
 * Add a purchase item. Adding the same item again (all six descriptive fields
 * match) adds to its quantity instead of creating a duplicate row, so the form
 * tells the user when that is about to happen.
 */
export function AddPurchaseItemSheet({ visible, projectId, items, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setForm(EMPTY);
      setError('');
    }
  }, [visible]);

  const set = (key: keyof Form) => (value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (error) setError('');
  };

  const match = useMemo(() => {
    if (!form.item.trim()) return null;
    const key = purchaseItemMatchKey(form);
    return items.find((i) => purchaseItemMatchKey(i) === key) ?? null;
  }, [form, items]);

  async function save() {
    const qty = Number(form.quantity);
    if (!form.item.trim()) return setError(t('purchase.errItem'));
    if (!qty || qty <= 0) return setError(t('purchase.errQty'));
    setSaving(true);
    try {
      const res = await api.post<PurchaseItem & { merged: boolean }>(`/projects/${projectId}/purchase-items`, {
        area: form.area, item: form.item, brand: form.brand, code: form.code, size: form.size, finish: form.finish, quantity: qty,
      });
      onSaved(res.data, !!res.data.merged);
      onClose();
    } catch (err) {
      const key = purchaseErrorKey(err);
      setError(key ? t(key) : t('purchase.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={visible} title={t('purchase.add')} onClose={onClose}>
      <TextField label={`${t('purchase.item')} *`} value={form.item} onChangeText={set('item')} autoCapitalize="sentences" />
      <TextField label={`${t('purchase.quantity')} *`} value={form.quantity} onChangeText={set('quantity')} keyboardType="decimal-pad" />
      <TextField label={t('purchase.area')} value={form.area} onChangeText={set('area')} />
      <TextField label={t('purchase.brand')} value={form.brand} onChangeText={set('brand')} />
      <TextField label={t('purchase.code')} value={form.code} onChangeText={set('code')} autoCapitalize="characters" />
      <TextField label={t('purchase.size')} value={form.size} onChangeText={set('size')} />
      <TextField label={t('purchase.finish')} value={form.finish} onChangeText={set('finish')} />

      {match ? (
        <Text style={styles.hint}>
          {t('purchase.mergeHint', { no: match.slNo, from: fmtQty(match.quantity), to: fmtQty(match.quantity + (Number(form.quantity) || 0)) })}
        </Text>
      ) : null}
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}

      <Button label={match ? t('purchase.addToExisting') : t('purchase.add')} icon="add" onPress={save} loading={saving} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.info, backgroundColor: colors.infoSoft, fontSize: 14, fontWeight: '600', padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 15, fontWeight: '600', backgroundColor: colors.dangerSoft, padding: 12, borderRadius: radius.md, marginBottom: spacing.md },
});
