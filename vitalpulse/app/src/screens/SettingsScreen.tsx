import React from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { useSettings } from '../context/SettingsContext';
import { Switch } from '../components/ui';
import { TEXT_SCALES } from '../theme';
import { deleteAllData, exportAllAsCsv } from '../storage/db';
import { writeExportFile } from '../storage/exportFile';
import { setDailyReminder } from '../notifications';

function SettingRow({
  title,
  subtitle,
  right,
  last,
  theme,
  textScale,
}: {
  title: string;
  subtitle: string;
  right: React.ReactNode;
  last?: boolean;
  theme: ReturnType<typeof useSettings>['theme'];
  textScale: number;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: theme.line,
      }}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={{ fontSize: 15 * textScale, fontWeight: '600', color: theme.ink }}>{title}</Text>
        <Text style={{ fontSize: 12.5 * textScale, color: theme.inkSoft, marginTop: 2 }}>{subtitle}</Text>
      </View>
      {right}
    </View>
  );
}

export function SettingsScreen({ onDataCleared }: { onDataCleared: () => void }) {
  const { theme, textScale, settings, updateSettings } = useSettings();

  const stepText = (delta: number) => {
    const nextIndex = Math.min(TEXT_SCALES.length - 1, Math.max(0, settings.textScaleIndex + delta));
    updateSettings({ textScaleIndex: nextIndex });
  };

  const toggleReminder = async (value: boolean) => {
    const granted = await setDailyReminder(value, settings.reminderHour, settings.reminderMinute);
    updateSettings({ reminderEnabled: granted && value });
  };

  const exportData = async () => {
    const csv = await exportAllAsCsv();
    const file = writeExportFile('vitalpulse-export.csv', csv);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', dialogTitle: 'Export your VitalPulse data' });
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete all data?',
      'This permanently removes every pulse and blood pressure reading stored on this device. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: async () => {
            await deleteAllData();
            onDataCleared();
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontWeight: '700', color: theme.ink, marginBottom: 14 }} accessibilityRole="header">
        Settings
      </Text>

      <View style={{ backgroundColor: theme.paper, borderWidth: 1, borderColor: theme.line, borderRadius: 20, paddingHorizontal: 14 }}>
        <SettingRow
          theme={theme}
          textScale={textScale}
          title="Text size"
          subtitle={`Step ${settings.textScaleIndex + 1} of ${TEXT_SCALES.length}`}
          right={
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => stepText(-1)}
                accessibilityRole="button"
                accessibilityLabel="Decrease text size"
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.ink }}>–</Text>
              </Pressable>
              <Pressable
                onPress={() => stepText(1)}
                accessibilityRole="button"
                accessibilityLabel="Increase text size"
                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: theme.line, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.ink }}>+</Text>
              </Pressable>
            </View>
          }
        />
        <SettingRow
          theme={theme}
          textScale={textScale}
          title="High-contrast theme"
          subtitle="Stronger colors, easier to read"
          right={<Switch value={settings.highContrast} onValueChange={(v) => updateSettings({ highContrast: v })} theme={theme} />}
        />
        <SettingRow
          theme={theme}
          textScale={textScale}
          title="Daily reminder"
          subtitle={`${String(settings.reminderHour).padStart(2, '0')}:${String(settings.reminderMinute).padStart(2, '0')}, once a day`}
          right={<Switch value={settings.reminderEnabled} onValueChange={toggleReminder} theme={theme} />}
        />
        <SettingRow
          theme={theme}
          textScale={textScale}
          title="Left-hand camera mode"
          subtitle="Shows Pulse Check instructions for your left hand"
          last
          right={
            <Switch value={settings.leftHandCameraMode} onValueChange={(v) => updateSettings({ leftHandCameraMode: v })} theme={theme} />
          }
        />
      </View>

      <Pressable
        onPress={exportData}
        accessibilityRole="button"
        style={{ marginTop: 18, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 16 * textScale, fontWeight: '700', color: theme.ink }}>⬇ Export my data</Text>
      </Pressable>

      <Pressable
        onPress={confirmDelete}
        accessibilityRole="button"
        style={{ marginTop: 12, borderWidth: 1, borderColor: theme.line, backgroundColor: theme.paper, borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
      >
        <Text style={{ fontSize: 16 * textScale, fontWeight: '700', color: theme.danger }}>Delete all my data</Text>
      </Pressable>
    </ScrollView>
  );
}
