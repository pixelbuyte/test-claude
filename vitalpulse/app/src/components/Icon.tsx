import React from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'heartPulse'
  | 'cuff'
  | 'home'
  | 'trend'
  | 'book'
  | 'settings'
  | 'lock'
  | 'info'
  | 'x'
  | 'finger'
  | 'download'
  | 'trash'
  | 'back'
  | 'backspace'
  | 'check'
  | 'camera';

interface IconProps {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}

/**
 * Small hand-drawn line-icon set shared with the HTML prototype, so the app
 * never falls back to emoji for its iconography (inconsistent rendering
 * across OSes, and reads as decoration rather than a designed UI).
 */
export function Icon({ name, size = 22, color, strokeWidth = 1.8 }: IconProps) {
  const common = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'heartPulse' && (
        <>
          <Path
            d="M12 20.2s-6.8-4.1-9.2-8.6A5.4 5.4 0 0 1 12 5.4a5.4 5.4 0 0 1 9.2 6.2c-2.4 4.5-9.2 8.6-9.2 8.6z"
            {...common}
          />
          <Path d="M4 12.5h3.2l1.6-3 1.8 6 1.7-8 1.6 5h4.1" {...common} />
        </>
      )}
      {name === 'cuff' && (
        <>
          <Path d="M4.6 15.4a7.4 7.4 0 0 1 14.8 0" {...common} />
          <Path d="M4.6 15.4h14.8" {...common} />
          <Path d="M12 15.4 15.1 10.6" {...common} />
          <Circle cx={12} cy={15.4} r={1} fill={color} stroke="none" />
        </>
      )}
      {name === 'home' && (
        <>
          <Path d="M4 11.5 12 4.3l8 7.2" {...common} />
          <Path d="M6.2 10v9.5h11.6V10" {...common} />
          <Path d="M10 19.5v-5.7h4v5.7" {...common} />
        </>
      )}
      {name === 'trend' && (
        <>
          <Path d="M4 16.5 8.6 10l3.6 2.8L18.3 5" {...common} />
          <Path d="M13.6 5h4.7v4.7" {...common} />
        </>
      )}
      {name === 'book' && (
        <>
          <Path d="M12 6.6c-1.9-1.5-4.3-2.2-7.4-2.2v13c3.1 0 5.5.7 7.4 2.2 1.9-1.5 4.3-2.2 7.4-2.2v-13c-3.1 0-5.5.7-7.4 2.2z" {...common} />
          <Path d="M12 6.6v13" {...common} />
        </>
      )}
      {name === 'settings' && (
        <>
          <Path d="M4 6.6h8.6" {...common} /><Circle cx={15.6} cy={6.6} r={2.1} {...common} />
          <Path d="M20 12h-4.6" {...common} /><Circle cx={8.4} cy={12} r={2.1} {...common} />
          <Path d="M4 17.4h8.6" {...common} /><Circle cx={15.6} cy={17.4} r={2.1} {...common} />
        </>
      )}
      {name === 'lock' && (
        <>
          <Rect x={5.2} y={10.4} width={13.6} height={9.6} rx={2.4} {...common} />
          <Path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8" {...common} />
        </>
      )}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={8.6} {...common} />
          <Path d="M12 11.2v5.2" {...common} />
          <Circle cx={12} cy={8} r={0.25} stroke={color} strokeWidth={2.6} fill="none" />
        </>
      )}
      {name === 'x' && (
        <>
          <Circle cx={12} cy={12} r={8.6} {...common} />
          <Path d="M8.4 8.4l7.2 7.2M15.6 8.4l-7.2 7.2" {...common} />
        </>
      )}
      {name === 'finger' && (
        <>
          <Path d="M12 4.4a7.6 7.6 0 0 1 7.6 7.6v2.6" {...common} />
          <Path d="M4.4 12A7.6 7.6 0 0 1 12 4.4" {...common} />
          <Path d="M7.2 12.6a4.8 4.8 0 0 1 9.6 0v2.6" {...common} />
          <Path d="M9.8 13a2.3 2.3 0 0 1 4.6 0v3.6" {...common} />
          <Path d="M12 13.3v4.8" {...common} />
        </>
      )}
      {name === 'download' && (
        <>
          <Path d="M12 4.4v10.6" {...common} />
          <Path d="M7.4 10.6l4.6 4.6 4.6-4.6" {...common} />
          <Path d="M5.2 19h13.6" {...common} />
        </>
      )}
      {name === 'trash' && (
        <>
          <Path d="M5 7.4h14" {...common} />
          <Path d="M9.2 7.4V5.6a1.8 1.8 0 0 1 1.8-1.8h2a1.8 1.8 0 0 1 1.8 1.8v1.8" {...common} />
          <Path d="M7.2 7.4 8 19h8l.8-11.6" {...common} />
        </>
      )}
      {name === 'back' && <Path d="M15.2 5 8 12l7.2 7" {...common} />}
      {name === 'backspace' && (
        <>
          <Path d="M8.4 6.5H19a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H8.4L3.4 12z" {...common} />
          <Path d="M11 9.6l4.2 4.2M15.2 9.6 11 13.8" {...common} />
        </>
      )}
      {name === 'check' && <Path d="M5 13l4 4 10-10" {...common} strokeWidth={strokeWidth + 0.4} />}
      {name === 'camera' && (
        <>
          <Rect x={3.6} y={7.4} width={16.8} height={12} rx={2.6} {...common} />
          <Path d="M8.4 7.4 9.8 4.8h4.4l1.4 2.6" {...common} />
          <Circle cx={12} cy={13.4} r={3.4} {...common} />
        </>
      )}
    </Svg>
  );
}
