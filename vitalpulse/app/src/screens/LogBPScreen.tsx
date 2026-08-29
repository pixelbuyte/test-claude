import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Button, Disclaimer, StatusPill } from '../components/ui';
import { Icon } from '../components/Icon';
import { FONTS } from '../theme';
import { bpCategory } from '../health/bpCategory';
import { insertBPReading } from '../storage/db';

type FieldKey = 'systolic' | 'diastolic' | 'pulse';

const FIELDS: { key: FieldKey; label: string }[] = [
  { key: 'systolic', label: 'Systolic' },
  { key: 'diastolic', label: 'Diastolic' },
  { key: 'pulse', label: 'Pulse' },
];

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'backspace', '0', 'check'];

export function LogBPScreen({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { theme, textScale } = useSettings();
  const [values, setValues] = useState<Record<FieldKey, string>>({ systolic: '', diastolic: '', pulse: '' });
  const [focused, setFocused] = useState<FieldKey>('systolic');

  const canSave = values.systolic.length > 0 && values.diastolic.length > 0;

  // Live category feedback the moment both numbers are plausible, so people
  // see where a reading falls before they commit it.
  const sys = Number(values.systolic);
  const dia = Number(values.diastolic);
  const liveCategory = canSave && sys >= 50 && sys <= 260 && dia >= 30 && dia <= 200 ? bpCategory(sys, dia) : null;

  const nextField = (): FieldKey | null => {
    const idx = FIELDS.findIndex((f) => f.key === focused);
    return idx < FIELDS.length - 1 ? FIELDS[idx + 1].key : null;
  };

  const handleKey = (key: string) => {
    if (key === 'backspace') {
      setValues((v) => ({ ...v, [focused]: v[focused].slice(0, -1) }));
      return;
    }
    if (key === 'check') {
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
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 8 }}>
        <Pressable
          onPress={onCancel}
          accessibilityRole="link"
          accessibilityLabel="Back to Home"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
        >
          <Icon name="back" size={16} color={theme.teal} strokeWidth={2} />
          <Text style={{ color: theme.teal, fontFamily: FONTS.bodyBold, fontSize: 14 * textScale }}>Home</Text>
        </Pressable>

        <Text style={{ fontSize: 22 * textScale, fontFamily: FONTS.display, color: theme.ink, marginTop: 12 }} accessibilityRole="header">
          Log blood pressure
        </Text>
        <Text style={{ fontSize: 14.5 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, marginBottom: 18 }}>
          Enter the reading from your own cuff.
        </Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
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
                  borderRadius: 16,
                  paddingVertical: 11,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 10.5 * textScale, fontFamily: FONTS.bodyBold, color: theme.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  {field.label}
                </Text>
                <Text style={{ fontSize: 26 * textScale, fontFamily: FONTS.num, color: theme.ink }}>
                  {values[field.key] || '–'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {liveCategory ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              backgroundColor: theme.paper,
              borderWidth: 1,
              borderColor: theme.line,
              borderRadius: 18,
              padding: 13,
              marginBottom: 10,
            }}
          >
            <StatusPill theme={theme} textScale={textScale} label={liveCategory.label} tone={liveCategory.tone} />
            <Text style={{ flex: 1, fontSize: 12.5 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, lineHeight: 17 * textScale }}>
              {liveCategory.blurb}
            </Text>
          </View>
        ) : null}

        <Disclaimer theme={theme} textScale={textScale}>
          Systolic (top number) is the pressure in your arteries when your heart beats. Diastolic (bottom number) is
          the pressure when it rests between beats.
        </Disclaimer>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {KEYS.map((key) => (
            <Pressable
              key={key}
              onPress={() => handleKey(key)}
              accessibilityRole="button"
              accessibilityLabel={key === 'backspace' ? 'Delete' : key === 'check' ? 'Next' : `Digit ${key}`}
              style={{
                width: '31%',
                paddingVertical: 14,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: theme.line,
                backgroundColor: theme.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {key === 'backspace' || key === 'check' ? (
                <Icon name={key as 'backspace' | 'check'} size={19} color={theme.ink} strokeWidth={key === 'check' ? 2.4 : 1.8} />
              ) : (
                <Text style={{ fontSize: 19 * textScale, fontFamily: FONTS.num, color: theme.ink }}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={{ padding: 22, paddingTop: 12 }}>
        <Button title="Save reading" theme={theme} textScale={textScale} onPress={save} accessibilityHint={canSave ? undefined : 'Enter systolic and diastolic first'} />
      </View>
    </View>
  );
}
