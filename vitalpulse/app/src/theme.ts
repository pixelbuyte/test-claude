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
}

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

export function useTheme(highContrast: boolean): Theme {
  const scheme = useColorScheme();
  const base = scheme === 'dark' ? dark : light;
  if (!highContrast) return base;
  // High-contrast mode pushes text/background further apart than the default palette.
  return {
    ...base,
    ink: scheme === 'dark' ? '#ffffff' : '#000000',
    bg: scheme === 'dark' ? '#000000' : '#ffffff',
    paper: scheme === 'dark' ? '#000000' : '#ffffff',
    inkSoft: scheme === 'dark' ? '#d8e4e1' : '#25403c',
    line: scheme === 'dark' ? '#4a635f' : '#9fb3ae',
  };
}
