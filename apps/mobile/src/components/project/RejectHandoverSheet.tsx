import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, describeApiError } from '../../services/api';
import { Button, Sheet, TextField } from '../ui';
import type { HandoverRow } from './HandoverItem';

interface Props {
  /** The handover being rejected, or null when the sheet is closed. */
  handover: HandoverRow | null;
  onClose: () => void;
  onRejected: () => void;
}

/** Rejecting a handover needs a reason (SOW: "rejection returns to sender with a reason"). */
export function RejectHandoverSheet({ handover, onClose, onRejected }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (handover) {
      setReason('');
      setError('');
    }
  }, [handover]);

  async function submit() {
    if (!handover) return;
    if (!reason.trim()) {
      setError(t('handover.rejectRequired'));
      return;
    }
    setSaving(true);
    try {
      await api.patch(`/handovers/${handover._id}/reject`, { reason: reason.trim() });
      onRejected();
      onClose();
    } catch (err) {
      const msg = describeApiError(err, t('common.checkConnection'));
      setError(msg === 'offline' ? t('common.checkConnection') : msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet visible={handover !== null} title={t('handover.reject')} onClose={onClose}>
      <TextField
        label={t('handover.rejectReason')}
        value={reason}
        onChangeText={(v) => {
          setReason(v);
          if (error) setError('');
        }}
        error={error}
        multiline
      />
      <Button label={t('handover.reject')} variant="danger" onPress={submit} loading={saving} />
    </Sheet>
  );
}
