import React from 'react';
import { ScrollView, Text } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { Card, Label } from '../components/ui';
import { PulseWaveform, GaugeSweep, PrivacyPulse } from '../components/HowItWorksAnimations';
import { FONTS } from '../theme';

export function HowItWorksScreen() {
  const { theme, textScale } = useSettings();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ padding: 22 }}>
      <Text style={{ fontSize: 22 * textScale, fontFamily: FONTS.display, color: theme.ink, marginBottom: 16 }} accessibilityRole="header">
        How this works
      </Text>

      <Card theme={theme}>
        <PulseWaveform theme={theme} />
        <Label theme={theme} textScale={textScale}>
          Pulse Check
        </Label>
        <Text style={{ fontSize: 14.5 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, lineHeight: 21 * textScale, marginTop: 7 }}>
          Uses your camera and flash to watch tiny color changes in your fingertip as blood moves through it, timing
          the beats to estimate heart rate and rhythm variability. This is real, useful data — but it is a wellness
          estimate, not a diagnosis. When your finger moves or the light is uneven, the app tells you the reading's
          signal quality instead of pretending every result is equally trustworthy.
        </Text>
      </Card>

      <Card theme={theme}>
        <GaugeSweep theme={theme} />
        <Label theme={theme} textScale={textScale}>
          Blood Pressure Log
        </Label>
        <Text style={{ fontSize: 14.5 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, lineHeight: 21 * textScale, marginTop: 7 }}>
          There is no way for a phone to measure blood pressure on its own — no camera, no fingerprint sensor, no
          app. That's what the needle above can't do on its own either: a real cuff is what takes the actual
          reading. Enter your numbers here and VitalPulse turns them into trends you and your doctor can use.
          {'\n\n'}Systolic (the top number) is the pressure in your arteries when your heart beats. Diastolic (the
          bottom number) is the pressure when your heart rests between beats.
        </Text>
      </Card>

      <Card theme={theme}>
        <PrivacyPulse theme={theme} />
        <Label theme={theme} textScale={textScale}>
          Your privacy
        </Label>
        <Text style={{ fontSize: 14.5 * textScale, fontFamily: FONTS.body, color: theme.inkSoft, lineHeight: 21 * textScale, marginTop: 7 }}>
          Every reading is stored only on this device, in a local database. Nothing is uploaded, sold, or shared
          with anyone — there is no account and no server. Delete it all anytime from Settings.
        </Text>
      </Card>
    </ScrollView>
  );
}
