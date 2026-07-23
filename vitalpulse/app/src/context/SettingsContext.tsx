import React, { createContext, useContext, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, Settings } from '../types';
import { loadSettings, saveSettings } from '../storage/db';
import { TEXT_SCALES, Theme, useTheme } from '../theme';

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  theme: Theme;
  textScale: number;
  updateSettings: (patch: Partial<Settings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const updateSettings = (patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const theme = useTheme(settings.highContrast);
  const textScale = TEXT_SCALES[settings.textScaleIndex] ?? 1;

  return (
    <SettingsContext.Provider value={{ settings, loaded, theme, textScale, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
}
