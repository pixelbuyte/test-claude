import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Theme } from '../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  theme: Theme;
  textScale: number;
  variant?: 'primary' | 'ghost' | 'quiet';
  danger?: boolean;
  accessibilityHint?: string;
}

/** Every button meets the 44pt minimum touch target this app promises in Settings. */
export function Button({ title, onPress, theme, textScale, variant = 'primary', danger, accessibilityHint }: ButtonProps) {
  const bg = variant === 'primary' ? theme.coral : variant === 'ghost' ? 'transparent' : theme.paper;
  const color = variant === 'primary' ? '#fff' : danger ? theme.danger : variant === 'ghost' ? theme.teal : theme.ink;
  const border = variant === 'ghost' ? theme.teal : variant === 'quiet' ? theme.line : 'transparent';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === 'primary' ? 0 : 1.5, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={{ color, fontSize: 17 * textScale, fontWeight: '700' }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ theme, children, filled }: { theme: Theme; children: React.ReactNode; filled?: boolean }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: filled ? theme.sage : theme.paper, borderColor: filled ? 'transparent' : theme.line },
      ]}
    >
      {children}
    </View>
  );
}

export function Disclaimer({ theme, textScale, children }: { theme: Theme; textScale: number; children: string }) {
  return (
    <View style={[styles.disclaimer, { borderColor: theme.line, backgroundColor: theme.paper }]}>
      <Text style={{ fontSize: 16 }}>⚠️</Text>
      <Text
        style={{ flex: 1, color: theme.inkSoft, fontSize: 13.5 * textScale, lineHeight: 19 * textScale }}
        accessibilityRole="text"
      >
        {children}
      </Text>
    </View>
  );
}

export function Label({ theme, textScale, children }: { theme: Theme; textScale: number; children: string }) {
  return (
    <Text
      style={{
        color: theme.inkSoft,
        fontSize: 12.5 * textScale,
        fontWeight: '700',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
      }}
    >
      {children}
    </Text>
  );
}

export function BigNumber({ theme, textScale, value, unit }: { theme: Theme; textScale: number; value: string; unit?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
      <Text style={{ color: theme.ink, fontSize: 42 * textScale, fontWeight: '700', letterSpacing: -0.5 }}>{value}</Text>
      {unit ? <Text style={{ color: theme.inkSoft, fontSize: 14 * textScale, fontWeight: '600' }}>{unit}</Text> : null}
    </View>
  );
}

export function Switch({ value, onValueChange, theme }: { value: boolean; onValueChange: (v: boolean) => void; theme: Theme }) {
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={[styles.switchTrack, { backgroundColor: value ? theme.teal : theme.line }]}
    >
      <View style={[styles.switchThumb, { left: value ? 23 : 3 }]} />
    </Pressable>
  );
}

export function ProgressRing({ progress, size = 200, theme, label, sublabel }: {
  progress: number; // 0-1
  size?: number;
  theme: Theme;
  label: string;
  sublabel: string;
}) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.coral}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: 48, fontWeight: '700', color: theme.ink, fontVariant: ['tabular-nums'] }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.inkSoft, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {sublabel}
      </Text>
    </View>
  );
}

export function Sparkline({ points, color, width = 280, height = 100 }: { points: number[]; color: string; width?: number; height?: number }) {
  if (points.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points
    .map((p, i) => `${i * step},${height - ((p - min) / range) * (height - 12) - 6}`)
    .join(' ');
  const [lastX, lastY] = coords.split(' ').slice(-1)[0].split(',');
  return (
    <Svg width={width} height={height}>
      <Polyline points={coords} fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={Number(lastX)} cy={Number(lastY)} r={4.5} fill={color} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: 14,
    marginVertical: 8,
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  switchThumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
});
