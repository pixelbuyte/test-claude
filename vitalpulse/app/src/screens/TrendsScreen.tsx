import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSettings } from '../context/SettingsContext';
import { Button, Label, Sparkline } from '../components/ui';
import { exportAllAsCsv, getRecentBPReadings, getRecentPulseReadings } from '../storage/db';
import { writeExportFile } from '../storage/exportFile';
import { BloodPressureReading, PulseReading } from '../types';

type RangeKey = 7 | 30 | 90;
const RANGES: RangeKey[] = [7, 30, 90];

function withinRange(iso: string, days: number): boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return new Date(iso).getTime() >= cutoff;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function TrendsScreen({ refreshSignal }: { refreshSignal: number }) {
  const { theme, textScale } = useSettings();
  const [range, setRange] = useState<RangeKey>(7);
  const [bps, setBps] = useState<BloodPressureReading[]>([]);
  const [pulses, setPulses] = useState<PulseReading[]>([]);

  useEffect(() => {
    (async () => {
      const [b, p] = await Promise.all([getRecentBPReadings(500), getRecentPulseReadings(500)]);
      setBps(b);
      setPulses(p);
    })();
  }, [refreshSignal]);

  const filteredBp = useMemo(() => bps.filter((r) => withinRange(r.takenAt, range)).slice().reverse(), [bps, range]);
  const filteredPulse = useMemo(
    () => pulses.filter((r) => withinRange(r.takenAt, range)).slice().reverse(),
    [pulses, range]
  );

  const sysAvg = average(filteredBp.map((r) => r.systolic));
  const diaAvg = average(filteredBp.map((r) => r.diastolic));
  const pulseAvg = average(filteredPulse.map((r) => r.bpm));

  const exportReport = async () => {
    const csv = await exportAllAsCsv();
    const file = writeExportFile('vitalpulse-report.csv', csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share your VitalPulse report' });
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontWeight: '700', color: theme.ink, marginBottom: 14 }} accessibilityRole="header">
        Trends
      </Text>

      <View style={{ flexDirection: 'row', backgroundColor: theme.sage, borderRadius: 12, padding: 3, marginBottom: 16 }}>
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === r }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 9,
              alignItems: 'center',
              backgroundColor: range === r ? theme.paper : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13 * textScale, fontWeight: '700', color: range === r ? theme.teal : theme.inkSoft }}>
              {r} days
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={{ backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 20, padding: 16, marginBottom: 14 }}>
        <Label theme={theme} textScale={textScale}>
          Blood pressure (mmHg)
        </Label>
        {filteredBp.length >= 2 ? (
          <>
            <Sparkline points={filteredBp.map((r) => r.systolic)} color={theme.teal} />
            <Sparkline points={filteredBp.map((r) => r.diastolic)} color={theme.coral} />
            <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
              <Text style={{ fontSize: 12 * textScale, color: theme.inkSoft }}>● Systolic avg {sysAvg}</Text>
              <Text style={{ fontSize: 12 * textScale, color: theme.inkSoft }}>● Diastolic avg {diaAvg}</Text>
            </View>
          </>
        ) : (
          <Text style={{ fontSize: 14 * textScale, color: theme.inkSoft, marginTop: 8 }}>
            Log a couple of readings to see a trend here.
          </Text>
        )}
      </View>

      <View style={{ backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 20, padding: 16, marginBottom: 16 }}>
        <Label theme={theme} textScale={textScale}>
          Resting pulse (bpm)
        </Label>
        {filteredPulse.length >= 2 ? (
          <>
            <Sparkline points={filteredPulse.map((r) => r.bpm)} color={theme.teal} height={80} />
            <Text style={{ fontSize: 12 * textScale, color: theme.inkSoft, marginTop: 4 }}>Avg {pulseAvg} bpm</Text>
          </>
        ) : (
          <Text style={{ fontSize: 14 * textScale, color: theme.inkSoft, marginTop: 8 }}>
            Run a pulse check to start this trend.
          </Text>
        )}
      </View>

      <Button title="⬇ Export report for my doctor" theme={theme} textScale={textScale} variant="quiet" onPress={exportReport} />
    </ScrollView>
  );
}
