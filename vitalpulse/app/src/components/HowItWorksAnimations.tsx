import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Circle, Path, Polyline } from 'react-native-svg';
import { Theme } from '../theme';
import { Icon } from './Icon';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * A little heartbeat-monitor style waveform that scrolls sideways forever.
 * Illustrates "the app is continuously watching your fingertip" without
 * needing a single word of extra copy.
 */
export function PulseWaveform({ theme, width = 280 }: { theme: Theme; width?: number }) {
  const scroll = useRef(new Animated.Value(0)).current;
  const unit = 140;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(scroll, {
        toValue: -unit,
        duration: 1800,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [scroll]);

  // One heartbeat cell is `unit` wide (flat, then a spike, then flat to the
  // end) repeated back to back; scrolling by exactly `unit` per loop is what
  // makes the seam invisible.
  const cell = (offset: number) =>
    `${offset},28 ${offset + 20},28 ${offset + 27},10 ${offset + 34},46 ${offset + 41},6 ${offset + 48},28 ${offset + unit},28`;
  const points = Array.from({ length: 5 }, (_, i) => cell(i * unit)).join(' ');

  return (
    <View style={{ width, height: 48, borderRadius: 14, backgroundColor: theme.tealTint, overflow: 'hidden', marginBottom: 12 }}>
      <Animated.View style={{ transform: [{ translateX: scroll }] }}>
        <Svg width={unit * 5} height={48}>
          <Polyline points={points} stroke={theme.teal} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
    </View>
  );
}

/**
 * A gauge needle sweeping back and forth. Pairs with the copy explaining
 * that a real cuff — not this animation — is what actually measures
 * anything; the motion is here to hold attention on a screen that's
 * otherwise all text, not to imply the phone is taking a reading.
 */
export function GaugeSweep({ theme, size = 88 }: { theme: Theme; size?: number }) {
  const sweep = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(sweep, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sweep]);

  const rotation = sweep.interpolate({ inputRange: [0, 1], outputRange: [-18, 18] });

  return (
    <View style={{ width: size, height: size * 0.75, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.tealTint, borderRadius: 14, marginBottom: 12 }}>
      <Svg width={size * 0.6} height={size * 0.5} viewBox="0 0 24 24">
        <Path d="M4.6 15.4a7.4 7.4 0 0 1 14.8 0" stroke={theme.line} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <Path d="M4.6 15.4h14.8" stroke={theme.line} strokeWidth={1.8} fill="none" strokeLinecap="round" />
        <AnimatedPath
          d="M12 15.4 15.1 10.6"
          stroke={theme.coral}
          strokeWidth={2}
          strokeLinecap="round"
          rotation={rotation}
          origin="12,15.4"
        />
        <Circle cx={12} cy={15.4} r={1.1} fill={theme.coral} />
      </Svg>
    </View>
  );
}

/** A gentle breathing pulse on the lock icon — quiet by design, since privacy is a reassurance, not a demo. */
export function PrivacyPulse({ theme, size = 88 }: { theme: Theme; size?: number }) {
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });

  return (
    <View style={{ width: size, height: size * 0.75, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.tealTint, borderRadius: 14, marginBottom: 12 }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name="lock" size={30} color={theme.teal} strokeWidth={1.7} />
      </Animated.View>
    </View>
  );
}
