import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  paper: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  line: string;
  teal: string;
  tealDeep: string;
  tealTint: string;
  coral: string;
  coralDeep: string;
  coralTint: string;
  gold: string;
  danger: string;
  /**
   * Semantic status ramp for blood-pressure categories. Deliberately separate
   * from the teal/coral brand accent: brand colors say "this is VitalPulse",
   * status colors say "here is where your number falls". Tuned to read as
   * calm reference information — no alarm red until the reading genuinely is
   * at crisis level.
   */
  status: Record<StatusTone, { fg: string; bg: string }>;
}

export type StatusTone = 'info' | 'good' | 'notice' | 'warn' | 'high' | 'critical';

const light: Theme = {
  bg: '#f4f1e8',
  paper: '#fffcf6',
  ink: '#111e1b',
  inkSoft: '#4b625d',
  inkFaint: '#8a9b96',
  line: '#dde3d5',
  teal: '#0b5d5a',
  tealDeep: '#062f2d',
  tealTint: '#e6efec',
  coral: '#e8734a',
  coralDeep: '#bd4f2a',
  coralTint: '#fbe8dd',
  gold: '#b8842c',
  danger: '#b3402f',
  status: {
    info: { fg: '#3b6b86', bg: '#e2eef4' },
    good: { fg: '#2f6b4f', bg: '#e2efe6' },
    notice: { fg: '#8a6a1f', bg: '#f6eeda' },
    warn: { fg: '#a35a24', bg: '#f9e9dc' },
    high: { fg: '#9c4020', bg: '#f8e3da' },
    critical: { fg: '#8d2317', bg: '#f7dcd8' },
  },
};

const dark: Theme = {
  bg: '#0e1716',
  paper: '#16211f',
  ink: '#eef4f2',
  inkSoft: '#aebdb9',
  inkFaint: '#6b7f7a',
  line: '#263934',
  teal: '#5fb3ac',
  tealDeep: '#bfe6e1',
  tealTint: '#1a2d29',
  coral: '#f0865c',
  coralDeep: '#ffab84',
  coralTint: '#2a2019',
  gold: '#d9ac5c',
  danger: '#e2857a',
  status: {
    info: { fg: '#8fc3dc', bg: '#1b2f39' },
    good: { fg: '#8ecfa8', bg: '#1a2f24' },
    notice: { fg: '#e0c07a', bg: '#302819' },
    warn: { fg: '#eda978', bg: '#33241a' },
    high: { fg: '#f0968a', bg: '#33201d' },
    critical: { fg: '#f5a096', bg: '#3a1e1b' },
  },
};

/** Text scale steps a user can choose in Settings, applied as a multiplier on every font size. */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;

/** Loaded via expo-font in App.tsx (see FONT_ASSETS). Display: wordmark & titles. Body: everything else. Num: big stat readouts. */
export const FONTS = {
  display: 'NationalPark-Bold',
  body: 'InstrumentSans-Regular',
  bodyBold: 'InstrumentSans-Bold',
  num: 'Outfit-Bold',
};

const highContrastStatus = {
  light: {
    info: { fg: '#14384c', bg: '#cfe4ee' },
    good: { fg: '#0f3d27', bg: '#cfe6d8' },
    notice: { fg: '#4d3a06', bg: '#f0e2bf' },
    warn: { fg: '#5e2f08', bg: '#f2dac6' },
    high: { fg: '#5c1d08', bg: '#f2d0c3' },
    critical: { fg: '#4f0d05', bg: '#f2c6bf' },
  },
  dark: {
    info: { fg: '#c6e5f5', bg: '#0d1b23' },
    good: { fg: '#c2ecd3', bg: '#0c1c14' },
    notice: { fg: '#f2dda9', bg: '#22190a' },
    warn: { fg: '#fbcaa6', bg: '#24150b' },
    high: { fg: '#fcc0b6', bg: '#24110e' },
    critical: { fg: '#fdc7bf', bg: '#26100d' },
  },
} as const;

export function useTheme(highContrast: boolean): Theme {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? dark : light;
  if (!highContrast) return base;
  // High-contrast mode pushes text/background further apart than the default
  // palette — including the status pills, whose default tints are gentle
  // enough to wash out against a pure white or pure black ground.
  return {
    ...base,
    ink: scheme === 'dark' ? '#ffffff' : '#000000',
    bg: scheme === 'dark' ? '#000000' : '#ffffff',
    paper: scheme === 'dark' ? '#000000' : '#ffffff',
    inkSoft: scheme === 'dark' ? '#d8e4e1' : '#25403c',
    line: scheme === 'dark' ? '#4a635f' : '#9fb3ae',
    status: scheme === 'dark' ? highContrastStatus.dark : highContrastStatus.light,
  };
}
