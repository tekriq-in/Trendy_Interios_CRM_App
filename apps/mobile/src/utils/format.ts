import type { TFunction } from 'i18next';

/** Locale for dates: Indian English or Tamil (SOW: Indian formats, shown in IST). */
export const localeFor = (language: string) => (language === 'ta' ? 'ta-IN' : 'en-IN');

const IST = 'Asia/Kolkata';

/** "3:45 pm" in IST. */
export function formatTime(iso: string | undefined, language: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(localeFor(language), { timeZone: IST, hour: 'numeric', minute: '2-digit' });
}

/** Calendar day in IST as YYYY-MM-DD, so "today" is the same day for everyone in India. */
function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: IST });
}

/** "Today", "Yesterday" or "12 Nov" for the date dividers in a chat thread. */
export function dateHeader(iso: string | undefined, language: string, t: TFunction): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const yesterday = new Date(now.getTime() - 86_400_000);
  if (istDay(d) === istDay(now)) return t('chat.today');
  if (istDay(d) === istDay(yesterday)) return t('chat.yesterday');
  return d.toLocaleDateString(localeFor(language), { timeZone: IST, day: 'numeric', month: 'short' });
}

/** Compact age for conversation rows: "now", "5m", "3h", "2d". */
export function relativeTime(iso: string | undefined, t: TFunction): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff) || diff < 60_000) return t('chat.now');
  if (diff < 3_600_000) return t('chat.minutesShort', { n: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t('chat.hoursShort', { n: Math.floor(diff / 3_600_000) });
  return t('chat.daysShort', { n: Math.floor(diff / 86_400_000) });
}

export function initials(name?: string): string {
  if (!name) return '?';
  return (
    name
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}
