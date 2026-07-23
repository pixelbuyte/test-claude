import { useColorScheme } from 'react-native';

export interface Theme {
  bg: string;
  paper: string;
  ink: string;
  inkSoft: string;
  line: string;
  teal: string;
  tealDeep: string;
  sage: string;
  coral: string;
  coralDeep: string;
  danger: string;
}

const light: Theme = {
  bg: '#f4f2ec',
  paper: '#ffffff',
  ink: '#122523',
  inkSoft: '#3f5754',
  line: '#dbe3df',
  teal: '#0b5d5a',
  tealDeep: '#083f3d',
  sage: '#e3ede9',
  coral: '#e8734a',
  coralDeep: '#c85a34',
  danger: '#b3402f',
};

const dark: Theme = {
  bg: '#0e1716',
  paper: '#152321',
  ink: '#eef4f2',
  inkSoft: '#aebdb9',
  line: '#25403c',
  teal: '#5fb3ac',
  tealDeep: '#bfe6e1',
  sage: '#1b2f2b',
  coral: '#f0865c',
  coralDeep: '#ffab84',
  danger: '#e2857a',
};

/** Text scale steps a user can choose in Settings, applied as a multiplier on every font size. */
export const TEXT_SCALES = [1, 1.15, 1.3, 1.5] as const;

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
