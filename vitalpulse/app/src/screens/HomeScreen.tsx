import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { BigNumber, Button, Card, Disclaimer, IconChip, Label } from '../components/ui';
import { FONTS } from '../theme';
import { getRecentBPReadings, getRecentPulseReadings } from '../storage/db';
import { BloodPressureReading, PulseReading } from '../types';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `today · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `yesterday · ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${time}`;
}

export function HomeScreen({
  refreshSignal,
  onCheckPulse,
  onLogBp,
}: {
  refreshSignal: number;
  onCheckPulse: () => void;
  onLogBp: () => void;
}) {
  const { theme, textScale } = useSettings();
  const [lastPulse, setLastPulse] = useState<PulseReading | null>(null);
  const [lastBp, setLastBp] = useState<BloodPressureReading | null>(null);

  useEffect(() => {
    (async () => {
      const [pulses, bps] = await Promise.all([getRecentPulseReadings(1), getRecentBPReadings(1)]);
      setLastPulse(pulses[0] ?? null);
      setLastBp(bps[0] ?? null);
    })();
  }, [refreshSignal]);

  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontFamily: FONTS.display, color: theme.ink }} accessibilityRole="header">
        Welcome back
      </Text>
      <Text style={{ fontSize: 14 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, marginBottom: 18 }}>{today}</Text>

      <Card theme={theme} filled>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label theme={theme} textScale={textScale}>
              {lastPulse ? `Last pulse check · ${formatWhen(lastPulse.takenAt)}` : 'No pulse check yet'}
            </Label>
            <View style={{ marginTop: 4 }}>
              <BigNumber
                theme={theme}
                textScale={textScale}
                value={lastPulse ? String(lastPulse.bpm) : '—'}
                unit={lastPulse ? 'bpm' : undefined}
              />
            </View>
          </View>
          <IconChip theme={theme} name="heartPulse" color={theme.teal} />
        </View>
      </Card>

      <Card theme={theme}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Label theme={theme} textScale={textScale}>
              {lastBp ? `Last BP reading · ${formatWhen(lastBp.takenAt)}` : 'No BP reading yet'}
            </Label>
            <View style={{ marginTop: 4 }}>
              <BigNumber
                theme={theme}
                textScale={textScale}
                value={lastBp ? `${lastBp.systolic} / ${lastBp.diastolic}` : '—'}
                unit={lastBp ? 'mmHg' : undefined}
              />
            </View>
          </View>
          <IconChip theme={theme} name="cuff" color={theme.coral} />
        </View>
      </Card>

      <Disclaimer theme={theme} textScale={textScale}>
        Pulse readings are a wellness estimate, not a medical diagnosis.
      </Disclaimer>

      <View style={{ marginTop: 6, gap: 12 }}>
        <Button title="Check my pulse" theme={theme} textScale={textScale} onPress={onCheckPulse} />
        <Button title="Log a blood pressure reading" theme={theme} textScale={textScale} variant="ghost" onPress={onLogBp} />
      </View>
    </ScrollView>
  );
}
