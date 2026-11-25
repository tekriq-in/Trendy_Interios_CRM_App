/**
 * Design tokens for the staff app. Every screen takes its colours, spacing and
 * type sizes from here so the app looks like one product and can be re-themed
 * in one place.
 *
 * The SOW asks for "large tap targets, minimal typing" for factory and site
 * workers, so sizes lean large: 16px body text, 52dp primary buttons and a
 * 48dp floor for anything tappable.
 */
export const colors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  onPrimary: '#FFFFFF',

  bg: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceMuted: '#F1F5F9',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',

  text: '#0F172A',
  textMuted: '#475569',
  textSubtle: '#64748B',
  placeholder: '#94A3B8',

  success: '#047857',
  successSoft: '#D1FAE5',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  info: '#1D4ED8',
  infoSoft: '#DBEAFE',
  neutral: '#475569',
  neutralSoft: '#E2E8F0',

  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const size = {
  /** Minimum tappable height/width for any control. */
  minTap: 48,
  /** Primary buttons and text inputs. */
  control: 52,
  icon: 22,
} as const;

export const font = {
  title: { fontSize: 26, fontWeight: '800' as const, color: colors.text },
  h2: { fontSize: 19, fontWeight: '700' as const, color: colors.text },
  h3: { fontSize: 16, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 16, fontWeight: '400' as const, color: colors.text },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, color: colors.text },
  caption: { fontSize: 13, fontWeight: '500' as const, color: colors.textSubtle },
  label: { fontSize: 14, fontWeight: '600' as const, color: colors.textMuted },
};

export const shadow = {
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
};

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Foreground / background pair for a tone, used by badges and chips. */
export const toneColors: Record<Tone, { fg: string; bg: string }> = {
  primary: { fg: colors.primary, bg: colors.primarySoft },
  success: { fg: colors.success, bg: colors.successSoft },
  warning: { fg: colors.warning, bg: colors.warningSoft },
  danger: { fg: colors.danger, bg: colors.dangerSoft },
  info: { fg: colors.info, bg: colors.infoSoft },
  neutral: { fg: colors.neutral, bg: colors.neutralSoft },
};

/** Task status to tone. Keys match the API's task.status values. */
export const taskStatusTone: Record<string, Tone> = {
  pending: 'warning',
  in_progress: 'info',
  done: 'success',
  blocked: 'danger',
};

/** Handover status to tone. Matches HandoverStatus in @ti/shared. */
export const handoverStatusTone: Record<string, Tone> = {
  draft: 'warning',
  confirmed: 'info',
  accepted: 'success',
  rejected: 'danger',
};
