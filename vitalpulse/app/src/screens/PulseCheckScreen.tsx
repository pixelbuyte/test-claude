import React, { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSettings } from '../context/SettingsContext';
import { Button, Disclaimer, ProgressRing } from '../components/ui';
import { capturePulse } from '../sensors/ppgSampler';
import { insertPulseReading } from '../storage/db';
import { PulseAnalysisResult } from '../sensors/pulseAnalysis';

const DURATION_MS = 20000;

type Phase = 'instructions' | 'capturing' | 'result';

export function PulseCheckScreen({ onDone, leftHandMode }: { onDone: () => void; leftHandMode: boolean }) {
  const { theme, textScale } = useSettings();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>('instructions');
  const [bpm, setBpm] = useState(0);
  const [remainingMs, setRemainingMs] = useState(DURATION_MS);
  const [result, setResult] = useState<PulseAnalysisResult | null>(null);
  const cameraRef = useRef<CameraView>(null);
  const cancelledRef = useRef(false);

  const start = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    cancelledRef.current = false;
    setPhase('capturing');
    setRemainingMs(DURATION_MS);
    const outcome = await capturePulse(cameraRef, {
      durationMs: DURATION_MS,
      isCancelled: () => cancelledRef.current,
      onProgress: (elapsed, duration) => setRemainingMs(Math.max(0, duration - elapsed)),
      onSample: (sample) => setBpm(Math.round(sample.value)),
    });
    if (cancelledRef.current) {
      setPhase('instructions');
      return;
    }
    setResult(outcome);
    if (outcome.bpm != null) {
      await insertPulseReading({
        takenAt: new Date().toISOString(),
        bpm: outcome.bpm,
        hrvRmssdMs: outcome.hrvRmssdMs,
        signalQuality: outcome.signalQuality,
      });
    }
    setPhase('result');
  };

  const cancel = () => {
    cancelledRef.current = true;
    onDone();
  };

  const progress = 1 - remainingMs / DURATION_MS;

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      {phase === 'capturing' ? (
        <CameraView
          ref={cameraRef}
          style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 2, opacity: 0 }}
          facing="back"
          enableTorch
        />
      ) : null}

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 26 }}>
        <Text style={{ fontSize: 22 * textScale, fontWeight: '700', color: theme.ink, marginBottom: 8 }} accessibilityRole="header">
          Pulse Check
        </Text>

        {phase === 'instructions' && (
          <>
            <Text style={{ fontSize: 15.5 * textScale, color: theme.inkSoft, textAlign: 'center', marginBottom: 18 }}>
              Gently cover {leftHandMode ? 'the' : 'the'} camera and flash on the back of your phone with your
              fingertip, then hold still for 20 seconds.
            </Text>
            <Text style={{ fontSize: 60 }}>{leftHandMode ? '🫲' : '🫱'}</Text>
          </>
        )}

        {phase === 'capturing' && (
          <ProgressRing
            progress={progress}
            theme={theme}
            label={bpm > 0 ? String(bpm) : '··'}
            sublabel={`${Math.ceil(remainingMs / 1000)}s remaining`}
          />
        )}

        {phase === 'result' && result && (
          <>
            {result.bpm != null ? (
              <>
                <Text style={{ fontSize: 56 * textScale, fontWeight: '700', color: theme.ink }}>{result.bpm}</Text>
                <Text style={{ fontSize: 14 * textScale, color: theme.inkSoft, marginBottom: 10 }}>beats per minute</Text>
                <Text style={{ fontSize: 13 * textScale, color: theme.inkSoft, marginBottom: 6 }}>
                  Signal quality: {result.signalQuality}
                  {result.signalQuality !== 'good' ? ' — try holding your finger a little more still' : ''}
                </Text>
                {result.hrvRmssdMs != null && (
                  <Text style={{ fontSize: 13 * textScale, color: theme.inkSoft }}>
                    Rhythm variability (HRV): {Math.round(result.hrvRmssdMs)} ms
                  </Text>
                )}
              </>
            ) : (
              <Text style={{ fontSize: 16 * textScale, color: theme.inkSoft, textAlign: 'center' }}>
                We couldn't get a clear enough reading. Try again with steady, gentle pressure over the camera and
                flash.
              </Text>
            )}
          </>
        )}

        <Disclaimer theme={theme} textScale={textScale}>
          Estimate only — not a substitute for a medical device.
        </Disclaimer>
      </View>

      <View style={{ padding: 22, paddingBottom: 34, gap: 12 }}>
        {phase === 'instructions' && <Button title="Start 20-second check" theme={theme} textScale={textScale} onPress={start} />}
        {phase === 'capturing' && <Button title="Cancel" theme={theme} textScale={textScale} variant="quiet" onPress={cancel} />}
        {phase === 'result' && (
          <>
            <Button title="Done" theme={theme} textScale={textScale} onPress={onDone} />
            {result?.bpm == null && (
              <Button title="Try again" theme={theme} textScale={textScale} variant="ghost" onPress={start} />
            )}
          </>
        )}
      </View>
    </View>
  );
}
