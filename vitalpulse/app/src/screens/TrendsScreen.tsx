import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSettings } from '../context/SettingsContext';
import { Button, EmptyState, Label, StatusPill } from '../components/ui';
import { TrendChart } from '../components/TrendChart';
import { FONTS } from '../theme';
import { bpCategory, NORMAL_BAND } from '../health/bpCategory';
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
  const avgCategory = sysAvg != null && diaAvg != null ? bpCategory(sysAvg, diaAvg) : null;

  const exportReport = async () => {
    const csv = await exportAllAsCsv();
    const file = writeExportFile('vitalpulse-report.csv', csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Share your VitalPulse report' });
    }
  };

  const cardStyle = {
    backgroundColor: theme.paper,
    borderWidth: 1,
    borderColor: theme.line,
    borderRadius: 22,
    padding: 17,
    marginBottom: 14,
  } as const;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontFamily: FONTS.display, color: theme.ink, marginBottom: 14 }} accessibilityRole="header">
        Trends
      </Text>

      <View style={{ flexDirection: 'row', backgroundColor: theme.tealTint, borderRadius: 14, padding: 4, marginBottom: 16 }}>
        {RANGES.map((r) => (
          <Pressable
            key={r}
            onPress={() => setRange(r)}
            accessibilityRole="button"
            accessibilityState={{ selected: range === r }}
            style={{
              flex: 1,
              paddingVertical: 9,
              borderRadius: 11,
              alignItems: 'center',
              backgroundColor: range === r ? theme.paper : 'transparent',
            }}
          >
            <Text style={{ fontSize: 13 * textScale, fontFamily: FONTS.bodyBold, color: range === r ? theme.teal : theme.inkSoft }}>
              {r} days
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={cardStyle}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <Label theme={theme} textScale={textScale}>
            Blood pressure (mmHg)
          </Label>
          {avgCategory ? (
            <StatusPill theme={theme} textScale={textScale} label={`Avg: ${avgCategory.label}`} tone={avgCategory.tone} />
          ) : null}
        </View>

        {filteredBp.length >= 2 ? (
          <>
            <TrendChart
              theme={theme}
              textScale={textScale}
              domain={[50, 190]}
              ticks={[60, 90, 120, 150, 180]}
              band={{ from: NORMAL_BAND.diastolic[0], to: NORMAL_BAND.systolic[1], label: 'Normal range' }}
              series={[
                {
                  label: `Systolic avg ${sysAvg}`,
                  color: theme.teal,
                  points: filteredBp.map((r) => ({ value: r.systolic, takenAt: r.takenAt })),
                },
                {
                  label: `Diastolic avg ${diaAvg}`,
                  color: theme.coral,
                  points: filteredBp.map((r) => ({ value: r.diastolic, takenAt: r.takenAt })),
                },
              ]}
            />
            <Text
              style={{
                fontSize: 12 * textScale,
                fontFamily: FONTS.body,
                color: theme.inkFaint,
                marginTop: 10,
                lineHeight: 17 * textScale,
              }}
            >
              Ranges shown are the American Heart Association’s published reference categories — a description of
              where your numbers fall, not a diagnosis. Your doctor sets what’s right for you.
            </Text>
          </>
        ) : (
          <EmptyState
            theme={theme}
            textScale={textScale}
            icon="cuff"
            title="No blood pressure trend yet"
            body="Log two or more readings from your cuff and your trend will appear here."
          />
        )}
      </View>

      <View style={cardStyle}>
        <Label theme={theme} textScale={textScale}>
          Resting pulse (bpm)
        </Label>
        {filteredPulse.length >= 2 ? (
          <TrendChart
            theme={theme}
            textScale={textScale}
            domain={[40, 130]}
            ticks={[50, 70, 90, 110]}
            band={{ from: 60, to: 100, label: 'Typical resting range' }}
            height={140}
            series={[
              {
                label: `Avg ${pulseAvg} bpm`,
                color: theme.teal,
                points: filteredPulse.map((r) => ({ value: r.bpm, takenAt: r.takenAt })),
              },
            ]}
          />
        ) : (
          <EmptyState
            theme={theme}
            textScale={textScale}
            icon="heartPulse"
            title="No pulse trend yet"
            body="Run a couple of pulse checks and you’ll see how your resting heart rate moves."
          />
        )}
      </View>

      <Button title="Export report for my doctor" icon="download" theme={theme} textScale={textScale} variant="quiet" onPress={exportReport} />
    </ScrollView>
  );
}
