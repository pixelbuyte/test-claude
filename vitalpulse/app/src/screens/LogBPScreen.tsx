import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Button } from '../components/ui';
import { insertBPReading } from '../storage/db';

type FieldKey = 'systolic' | 'diastolic' | 'pulse';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'systolic', label: 'Systolic' },
  { key: 'diastolic', label: 'Diastolic' },
  { key: 'pulse', label: 'Pulse' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

export function LogBPScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { theme, textScale } = useSettings();
  const [values, setValues] = useState<Record<FieldKey, string>>({ systolic: '', diastolic: '', pulse: '' });
  const [focused, setFocused] = useState<FieldKey>('systolic');

  const canSave = values.systolic.length > 0 && values.diastolic.length > 0;

  const nextField = (): FieldKey | null => {
    const idx = FIELDS.findIndex((f) => f.key === focused);
    return idx < FIELDS.length - 1 ? FIELDS[idx + 1].key : null;
  };

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setValues((v) => ({ ...v, [focused]: v[focused].slice(0, -1) }));
      return;
    }
    if (key === '✓') {
      const next = nextField();
      if (next) setFocused(next);
      else if (canSave) save();
      return;
    }
    setValues((v) => (v[focused].length >= 3 ? v : { ...v, [focused]: v[focused] + key }));
  };

  const save = async () => {
    if (!canSave) return;
    await insertBPReading({
      takenAt: new Date().toISOString(),
      systolic: Number(values.systolic),
      diastolic: Number(values.diastolic),
      pulseBpm: values.pulse ? Number(values.pulse) : null,
    });
    onDone();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, padding: 22 }}>
      <Pressable onPress={onCancel} accessibilityRole="link" accessibilityLabel="Back to Home">
        <Text style={{ color: theme.teal, fontWeight: '700', fontSize: 14 * textScale }}>← Home</Text>
      </Pressable>

      <Text style={{ fontSize: 22 * textScale, fontWeight: '700', color: theme.ink, marginTop: 12 }} accessibilityRole="header">
        Log blood pressure
      </Text>
      <Text style={{ fontSize: 14.5 * textScale, color: theme.inkSoft, marginBottom: 18 }}>
        Enter the reading from your own cuff.
      </Text>

      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
        {FIELDS.map((field) => {
          const isFocused = focused === field.key;
          return (
            <Pressable
              key={field.key}
              onPress={() => setFocused(field.key)}
              accessibilityRole="button"
              accessibilityLabel={`${field.label} field`}
              style={{
                flex: 1,
                backgroundColor: theme.paper,
                borderWidth: 1.5,
                borderColor: isFocused ? theme.teal : theme.line,
                borderRadius: 14,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 11 * textScale, fontWeight: '700', color: theme.inkSoft, textTransform: 'uppercase' }}>
                {field.label}
              </Text>
              <Text style={{ fontSize: 26 * textScale, fontWeight: '700', color: theme.ink }}>
                {values[field.key] || '–'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            onPress={() => handleKey(key)}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Delete' : key === '✓' ? 'Next' : `Digit ${key}`}
            style={{
              width: '31%',
              paddingVertical: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: theme.line,
              backgroundColor: theme.paper,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 19 * textScale, fontWeight: '600', color: theme.ink }}>{key}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ marginTop: 'auto', paddingTop: 16 }}>
        <Button title="Save reading" theme={theme} textScale={textScale} onPress={save} accessibilityHint={canSave ? undefined : 'Enter systolic and diastolic first'} />
      </View>
    </View>
  );
}
