import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { FONTS, StatusTone, Theme } from '../theme';
import { Icon, IconName } from './Icon';

interface ButtonProps {
  title: string;
  onPress: () => void;
  theme: Theme;
  textScale: number;
  variant?: 'primary' | 'ghost' | 'quiet';
  danger?: boolean;
  icon?: IconName;
  accessibilityHint?: string;
}

/** Every button meets the 44pt minimum touch target this app promises in Settings. */
export function Button({ title, onPress, theme, textScale, variant = 'primary', danger, icon, accessibilityHint }: ButtonProps) {
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
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'primary' ? 0 : 1.5,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.94 : 1,
        },
        variant === 'primary' && {
          shadowColor: theme.coral,
          shadowOpacity: 0.4,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 8 },
          elevation: 5,
        },
      ]}
    >
      {icon ? <Icon name={icon} size={17} color={color} strokeWidth={1.8} /> : null}
      <Text style={{ color, fontSize: 17 * textScale, fontFamily: FONTS.bodyBold }}>{title}</Text>
    </Pressable>
  );
}

export function Card({ theme, children, filled }: { theme: Theme; children: React.ReactNode; filled?: boolean }) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: filled ? theme.tealTint : theme.paper, borderColor: filled ? 'transparent' : theme.line },
      ]}
    >
      {children}
    </View>
  );
}

export function Disclaimer({ theme, textScale, children }: { theme: Theme; textScale: number; children: string }) {
  return (
    <View style={[styles.disclaimer, { borderColor: theme.line, backgroundColor: theme.paper }]}>
      <Icon name="info" size={18} color={theme.gold} />
      <Text
        style={{ flex: 1, color: theme.inkSoft, fontFamily: FONTS.body, fontSize: 13.5 * textScale, lineHeight: 19 * textScale }}
        accessibilityRole="text"
      >
        {children}
      </Text>
    </View>
  );
}

/**
 * The category pill shown next to a blood pressure reading. Uses the semantic
 * status ramp, plus a text label — never color alone — so it still reads for
 * colorblind users and screen readers.
 */
export function StatusPill({ theme, textScale, label, tone }: { theme: Theme; textScale: number; label: string; tone: StatusTone }) {
  const { fg, bg } = theme.status[tone];
  return (
    <View style={{ alignSelf: 'flex-start', flexShrink: 0, backgroundColor: bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text numberOfLines={1} style={{ color: fg, fontFamily: FONTS.bodyBold, fontSize: 11.5 * textScale, letterSpacing: 0.3 }}>
        {label}
      </Text>
    </View>
  );
}

/** A designed empty state — an icon and a next step, rather than a line of grey text. */
export function EmptyState({ theme, textScale, icon, title, body }: {
  theme: Theme;
  textScale: number;
  icon: IconName;
  title: string;
  body: string;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 22, paddingHorizontal: 8 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 17,
          backgroundColor: theme.tealTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <Icon name={icon} size={24} color={theme.teal} strokeWidth={1.7} />
      </View>
      <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15 * textScale, color: theme.ink, textAlign: 'center' }}>{title}</Text>
      <Text
        style={{
          fontFamily: FONTS.body,
          fontSize: 13.5 * textScale,
          color: theme.inkSoft,
          textAlign: 'center',
          lineHeight: 19 * textScale,
          marginTop: 4,
        }}
      >
        {body}
      </Text>
    </View>
  );
}

/** The small rounded-square icon badge used on Home's summary cards. */
export function IconChip({ theme, name, color }: { theme: Theme; name: IconName; color: string }) {
  return (
    <View
      style={{
        width: 46,
        height: 46,
        borderRadius: 15,
        backgroundColor: theme.paper,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#111a18',
        shadowOpacity: 0.12,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Icon name={name} size={22} color={color} />
    </View>
  );
}

export function Label({ theme, textScale, children }: { theme: Theme; textScale: number; children: string }) {
  return (
    <Text
      style={{
        color: theme.inkSoft,
        fontFamily: FONTS.bodyBold,
        fontSize: 12.5 * textScale,
        letterSpacing: 0.5,
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
      <Text style={{ color: theme.ink, fontFamily: FONTS.num, fontSize: 42 * textScale, letterSpacing: -0.5 }}>{value}</Text>
      {unit ? <Text style={{ color: theme.inkSoft, fontFamily: FONTS.bodyBold, fontSize: 14 * textScale }}>{unit}</Text> : null}
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
      <Text style={{ fontSize: 48, fontFamily: FONTS.num, color: theme.ink, fontVariant: ['tabular-nums'] }}>{label}</Text>
      <Text style={{ fontSize: 12, fontFamily: FONTS.bodyBold, color: theme.inkSoft, textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 19,
    marginBottom: 14,
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 11,
    borderRadius: 18,
    borderWidth: 1,
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
