import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Button, Disclaimer } from '../components/ui';
import { Icon, IconName } from '../components/Icon';
import { FONTS } from '../theme';

const STEPS: { icon: IconName; title: string; body: string; disclaimer?: string }[] = [
  {
    icon: 'heartPulse',
    title: 'Know your numbers',
    body: 'VitalPulse tracks your pulse and blood pressure over time, and helps you spot what’s worth a call to your doctor.',
  },
  {
    icon: 'x',
    title: 'What we won’t do',
    body: 'No sensor — not your camera, not your fingerprint — can measure blood pressure. Anyone who tells you otherwise is wrong.',
    disclaimer:
      'Pulse Check estimates heart rate & rhythm variability only. For blood pressure, you’ll log real readings from your own cuff — it takes about 10 seconds.',
  },
  {
    icon: 'lock',
    title: 'Your data stays on your phone',
    body: 'No account. No cloud. Nothing shared with us or anyone else. You can export or delete everything, anytime, from Settings.',
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const { theme, textScale } = useSettings();
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View
          style={{
            width: 84,
            height: 84,
            borderRadius: 26,
            backgroundColor: current.icon === 'x' ? theme.coralTint : theme.tealTint,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 22,
          }}
        >
          <Icon name={current.icon} size={36} color={current.icon === 'x' ? theme.coral : theme.teal} strokeWidth={1.7} />
        </View>
        <Text
          style={{ fontSize: 24 * textScale, fontFamily: FONTS.display, color: theme.ink, textAlign: 'center', marginBottom: 10 }}
          accessibilityRole="header"
        >
          {current.title}
        </Text>
        <Text style={{ fontSize: 16 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, textAlign: 'center', lineHeight: 23 * textScale }}>
          {current.body}
        </Text>
        {current.disclaimer ? (
          <Disclaimer theme={theme} textScale={textScale}>
            {current.disclaimer}
          </Disclaimer>
        ) : null}
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 20 }}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === step ? 18 : 7,
                height: 7,
                borderRadius: 4,
                backgroundColor: i === step ? theme.teal : theme.line,
              }}
            />
          ))}
        </View>
      </ScrollView>
      <View style={{ padding: 22, paddingBottom: 34 }}>
        <Button
          title={isLast ? 'Get started' : 'Continue'}
          theme={theme}
          textScale={textScale}
          onPress={() => (isLast ? onDone() : setStep((s) => s + 1))}
        />
      </View>
    </View>
  );
}
