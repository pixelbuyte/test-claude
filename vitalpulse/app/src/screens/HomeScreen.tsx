import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { BigNumber, Button, Card, Disclaimer, IconChip, Label, StatusPill } from '../components/ui';
import { FONTS } from '../theme';
import { bpCategory } from '../health/bpCategory';
import { getRecentBPReadings, getRecentPulseReadings } from '../storage/db';
import { BloodPressureReading, PulseReading } from '../types';

/** No name, because there's no account by design — the time of day is the only thing we know. */
function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

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
  const bpStatus = lastBp ? bpCategory(lastBp.systolic, lastBp.diastolic) : null;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontFamily: FONTS.display, color: theme.ink }} accessibilityRole="header">
        {greeting()}
      </Text>
      <Text style={{ fontSize: 14 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, marginBottom: 18 }}>{today}</Text>

      {/* Blood pressure leads: it's the reading with real clinical meaning, and
          the only one carrying a category. Pulse is the supporting metric. */}
      <Card theme={theme} filled>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Label theme={theme} textScale={textScale}>
              {lastBp ? `Last BP reading · ${formatWhen(lastBp.takenAt)}` : 'No BP reading yet'}
            </Label>
            <View style={{ marginTop: 6, marginBottom: lastBp ? 10 : 0 }}>
              <BigNumber
                theme={theme}
                textScale={textScale}
                value={lastBp ? `${lastBp.systolic}/${lastBp.diastolic}` : '—'}
                unit={lastBp ? 'mmHg' : undefined}
              />
            </View>
            {bpStatus ? (
              <StatusPill theme={theme} textScale={textScale} label={bpStatus.label} tone={bpStatus.tone} />
            ) : null}
          </View>
          <IconChip theme={theme} name="cuff" color={theme.coral} />
        </View>
        {bpStatus ? (
          <Text
            style={{
              fontSize: 12.5 * textScale,
              fontFamily: FONTS.body,
              color: theme.inkSoft,
              lineHeight: 18 * textScale,
              marginTop: 10,
            }}
          >
            {bpStatus.blurb} This is a reference range, not a diagnosis.
          </Text>
        ) : null}
      </Card>

      <Card theme={theme}>
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
