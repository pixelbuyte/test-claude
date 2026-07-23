export type MainTab = 'home' | 'trends' | 'how' | 'settings';

export type Screen = { name: 'main'; tab: MainTab } | { name: 'pulseCheck' } | { name: 'logBp' };
