import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { FONTS, Theme } from '../theme';

export interface Series {
  label: string;
  points: { value: number; takenAt: string }[];
  color: string;
}

interface TrendChartProps {
  theme: Theme;
  textScale: number;
  series: Series[];
  /**
   * Fixed y-axis domain. Deliberately NOT derived from the data: auto-scaling
   * makes a 3-point drift and a 60-point spike draw the identical shape, which
   * is actively misleading on a health chart. A fixed clinical scale means the
   * line's steepness always means the same thing.
   */
  domain: [number, number];
  ticks: number[];
  /** Optional shaded reference range (e.g. the AHA "normal" band). */
  band?: { from: number; to: number; label: string };
  height?: number;
}

const PAD_LEFT = 34;
const PAD_RIGHT = 10;
const PAD_TOP = 10;
const PAD_BOTTOM = 20;

function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function TrendChart({ theme, textScale, series, domain, ticks, band, height = 170 }: TrendChartProps) {
  const [width, setWidth] = React.useState(0);
  const plotW = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const [min, max] = domain;
  const span = max - min || 1;

  const y = (v: number) => PAD_TOP + plotH - ((Math.min(max, Math.max(min, v)) - min) / span) * plotH;

  const longest = series.reduce((n, s) => Math.max(n, s.points.length), 0);
  const x = (i: number) => PAD_LEFT + (longest <= 1 ? plotW / 2 : (i / (longest - 1)) * plotW);

  const axisFont = 9.5 * Math.min(textScale, 1.3);
  const allPoints = series[0]?.points ?? [];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ width: '100%' }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            {series.map((s, si) => (
              <LinearGradient key={si} id={`fill${si}`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={s.color} stopOpacity={0.18} />
                <Stop offset="1" stopColor={s.color} stopOpacity={0} />
              </LinearGradient>
            ))}
          </Defs>

          {/* Reference band — the "this is the normal range" context that turns
              a squiggle into information. */}
          {band ? (
            <G>
              <Rect
                x={PAD_LEFT}
                y={y(band.to)}
                width={plotW}
                height={Math.max(0, y(band.from) - y(band.to))}
                fill={theme.teal}
                opacity={0.07}
              />
              <SvgText
                x={PAD_LEFT + 4}
                y={y(band.to) + axisFont + 2}
                fill={theme.inkFaint}
                fontSize={axisFont}
                fontFamily={FONTS.body}
              >
                {band.label}
              </SvgText>
            </G>
          ) : null}

          {/* Gridlines + y-axis labels */}
          {ticks.map((t) => (
            <G key={t}>
              <Line x1={PAD_LEFT} y1={y(t)} x2={width - PAD_RIGHT} y2={y(t)} stroke={theme.line} strokeWidth={1} />
              <SvgText
                x={PAD_LEFT - 6}
                y={y(t) + axisFont / 3}
                fill={theme.inkFaint}
                fontSize={axisFont}
                fontFamily={FONTS.body}
                textAnchor="end"
              >
                {t}
              </SvgText>
            </G>
          ))}

          {series.map((s, si) => {
            if (s.points.length === 0) return null;
            const line = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
            const area = `${line} L${x(s.points.length - 1)},${PAD_TOP + plotH} L${x(0)},${PAD_TOP + plotH} Z`;
            const last = s.points[s.points.length - 1];
            return (
              <G key={si}>
                <Path d={area} fill={`url(#fill${si})`} />
                <Path d={line} stroke={s.color} strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {/* Emphasized endpoint — the most recent reading is the one
                    people actually look for. */}
                <Circle cx={x(s.points.length - 1)} cy={y(last.value)} r={4.5} fill={s.color} />
                <Circle cx={x(s.points.length - 1)} cy={y(last.value)} r={7.5} fill={s.color} opacity={0.2} />
              </G>
            );
          })}

          {/* X-axis: first and last date only — enough to anchor the range
              without crowding a phone-width chart. */}
          {allPoints.length >= 2 ? (
            <G>
              <SvgText x={PAD_LEFT} y={height - 5} fill={theme.inkFaint} fontSize={axisFont} fontFamily={FONTS.body}>
                {formatDay(allPoints[0].takenAt)}
              </SvgText>
              <SvgText
                x={width - PAD_RIGHT}
                y={height - 5}
                fill={theme.inkFaint}
                fontSize={axisFont}
                fontFamily={FONTS.body}
                textAnchor="end"
              >
                {formatDay(allPoints[allPoints.length - 1].takenAt)}
              </SvgText>
            </G>
          ) : null}
        </Svg>
      ) : (
        <View style={{ height }} />
      )}

      <View style={{ flexDirection: 'row', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
        {series.map((s) => (
          <View key={s.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: s.color }} />
            <Text style={{ fontSize: 12 * textScale, fontFamily: FONTS.bodyBold, color: theme.inkSoft }}>{s.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
