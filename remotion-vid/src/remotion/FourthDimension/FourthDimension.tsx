import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/* ------------------------------------------------------------------ */
/*  Palette                                                            */
/* ------------------------------------------------------------------ */
const BG = "#05060f";
const BG_2 = "#0c1030";
const VOID = "#020308";
const CYAN = "#5cf2ff";
const VIOLET = "#a06bff";
const MAGENTA = "#ff5cc8";
const GOLD = "#ffd36b";
const TEXT = "#eef3ff";
const TEXT_DIM = "#8da0c8";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO = "'SF Mono', Menlo, Monaco, Consolas, monospace";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */
const useFade = (inFrame: number, outFrame: number, hold = 14) => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [inFrame, inFrame + hold], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(frame, [outFrame - hold, outFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(fadeIn, fadeOut);
};

const Caption: React.FC<{
  kicker?: string;
  lines: string[];
  appearAt?: number;
  bottom?: number;
}> = ({ kicker, lines, appearAt = 8, bottom = 90 }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [appearAt, appearAt + 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [appearAt, appearAt + 18], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        opacity: op,
        transform: `translateY(${y}px)`,
        textAlign: "center",
        padding: "0 120px",
      }}
    >
      {kicker ? (
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: CYAN,
            letterSpacing: 8,
            textTransform: "uppercase",
          }}
        >
          {kicker}
        </div>
      ) : null}
      {lines.map((l, i) => (
        <div
          key={i}
          style={{
            fontSize: 40,
            fontWeight: 600,
            color: TEXT,
            lineHeight: 1.25,
            letterSpacing: -0.5,
            textShadow: "0 2px 30px rgba(0,0,0,0.8)",
          }}
        >
          {l}
        </div>
      ))}
    </div>
  );
};

/* Drifting starfield background — deterministic, no Math.random at runtime */
const Stars: React.FC<{ count?: number; opacity?: number }> = ({
  count = 90,
  opacity = 1,
}) => {
  const frame = useCurrentFrame();
  const stars = [];
  for (let i = 0; i < count; i++) {
    // pseudo-random but deterministic
    const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
    const sy = (Math.sin(i * 78.233) * 12543.123) % 1;
    const x = ((sx + 1) % 1) * 1920;
    const y = ((sy + 1) % 1) * 1080;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin((frame + i * 9) / 22));
    const size = 1 + ((i % 5) === 0 ? 2 : 0);
    stars.push(
      <circle
        key={i}
        cx={x}
        cy={y}
        r={size}
        fill={i % 7 === 0 ? CYAN : "#ffffff"}
        opacity={tw * 0.7 * opacity}
      />,
    );
  }
  return (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0 }}
    >
      {stars}
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  The Tesseract — real 4D → 3D → 2D projection                      */
/* ------------------------------------------------------------------ */
type V4 = [number, number, number, number];

const TESSERACT_VERTICES: V4[] = (() => {
  const v: V4[] = [];
  for (let x = -1; x <= 1; x += 2)
    for (let y = -1; y <= 1; y += 2)
      for (let z = -1; z <= 1; z += 2)
        for (let w = -1; w <= 1; w += 2) v.push([x, y, z, w]);
  return v;
})();

const TESSERACT_EDGES: [number, number][] = (() => {
  const e: [number, number][] = [];
  for (let i = 0; i < 16; i++)
    for (let j = i + 1; j < 16; j++) {
      let diff = 0;
      for (let k = 0; k < 4; k++)
        if (TESSERACT_VERTICES[i][k] !== TESSERACT_VERTICES[j][k]) diff++;
      if (diff === 1) e.push([i, j]);
    }
  return e;
})();

const rot = (
  p: V4,
  a: number,
  b: number,
  angle: number,
): V4 => {
  const q: V4 = [...p] as V4;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const va = p[a];
  const vb = p[b];
  q[a] = va * c - vb * s;
  q[b] = va * s + vb * c;
  return q;
};

const Tesseract: React.FC<{
  scale?: number;
  speed?: number;
  glow?: number;
  cx?: number;
  cy?: number;
}> = ({ scale = 200, speed = 1, glow = 1, cx = 960, cy = 470 }) => {
  const frame = useCurrentFrame();
  const t = (frame / 30) * speed;

  // rotate in xw and yz and zw planes for a rich 4D tumble
  const projected = TESSERACT_VERTICES.map((p0) => {
    let p = rot(p0, 0, 3, t * 0.6); // x-w
    p = rot(p, 1, 2, t * 0.45); // y-z
    p = rot(p, 2, 3, t * 0.3); // z-w
    p = rot(p, 0, 1, t * 0.2); // x-y

    // 4D -> 3D perspective
    const wDist = 3;
    const w4 = 1 / (wDist - p[3]);
    let x = p[0] * w4;
    let y = p[1] * w4;
    let z = p[2] * w4;

    // 3D -> 2D perspective
    const zDist = 3.2;
    const w3 = 1 / (zDist - z);
    return {
      x: cx + x * w3 * scale * 3.2,
      y: cy + y * w3 * scale * 3.2,
      depth: w4, // inner (small w4) vs outer cell
    };
  });

  const maxDepth = Math.max(...projected.map((p) => p.depth));
  const minDepth = Math.min(...projected.map((p) => p.depth));

  return (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <filter id="tessglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={6 * glow} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={CYAN} stopOpacity="0.9" />
          <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* central core glow */}
      <circle cx={cx} cy={cy} r={120 * glow} fill="url(#core)" opacity={0.5} />

      <g filter="url(#tessglow)">
        {TESSERACT_EDGES.map(([a, b], i) => {
          const pa = projected[a];
          const pb = projected[b];
          const d = (pa.depth + pb.depth) / 2;
          const norm =
            maxDepth === minDepth
              ? 0.5
              : (d - minDepth) / (maxDepth - minDepth);
          // outer cell cyan, inner cell magenta/violet
          const color =
            norm > 0.66 ? CYAN : norm > 0.33 ? VIOLET : MAGENTA;
          const strokeW = 1.4 + norm * 3.2;
          return (
            <line
              key={i}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={color}
              strokeWidth={strokeW}
              strokeLinecap="round"
              opacity={0.35 + norm * 0.6}
            />
          );
        })}
        {projected.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={3 + (p.depth - minDepth) * 14}
            fill={TEXT}
            opacity={0.9}
          />
        ))}
      </g>
    </svg>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 1 — Title                                                   */
/* ------------------------------------------------------------------ */
const TitleScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const op = useFade(0, durationInFrames, 16);
  const titleOp = interpolate(frame, [14, 38], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [14, 38], [30, 0], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [40, 64], [0, 1], {
    extrapolateRight: "clamp",
  });
  const tessScale = spring({
    frame,
    fps,
    config: { damping: 16, stiffness: 70, mass: 1.2 },
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 40%, ${BG_2} 0%, ${BG} 60%, ${VOID} 100%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={120} />
      <div style={{ opacity: 0.55, transform: `scale(${0.6 + tessScale * 0.4})` }}>
        <Tesseract scale={150} speed={1} glow={1.2} cy={420} />
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 150,
        }}
      >
        <div
          style={{
            fontSize: 26,
            letterSpacing: 12,
            textTransform: "uppercase",
            color: CYAN,
            opacity: subOp,
            marginBottom: 18,
          }}
        >
          A short film
        </div>
        <div
          style={{
            fontSize: 104,
            fontWeight: 800,
            color: TEXT,
            letterSpacing: -3,
            opacity: titleOp,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
            lineHeight: 1.02,
            textShadow: `0 0 60px ${VIOLET}55`,
          }}
        >
          The Visitor from
          <br />
          the Fourth Dimension
        </div>
        <div
          style={{
            fontSize: 30,
            color: TEXT_DIM,
            letterSpacing: 3,
            opacity: subOp,
            marginTop: 22,
          }}
        >
          what a 4D being could do in our world
        </div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 2 — Arrival (tesseract unfolds into our space)              */
/* ------------------------------------------------------------------ */
const ArrivalScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 14);
  // a rift opens, then the tesseract grows through it
  const rift = interpolate(frame, [0, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const tessIn = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const flash = interpolate(frame, [28, 40, 60], [0, 0.8, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: VOID, fontFamily: FONT, opacity: op }}>
      <Stars count={70} opacity={0.6} />
      {/* the rift */}
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <radialGradient id="rift" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="30%" stopColor={CYAN} stopOpacity="0.7" />
            <stop offset="70%" stopColor={VIOLET} stopOpacity="0.3" />
            <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse
          cx={960}
          cy={460}
          rx={20 + rift * 360}
          ry={6 + rift * 460}
          fill="url(#rift)"
          opacity={0.85}
        />
      </svg>

      <div style={{ opacity: tessIn, transform: `scale(${0.4 + tessIn * 0.7})` }}>
        <Tesseract scale={170} speed={1.3} glow={1.4} cy={460} />
      </div>

      <AbsoluteFill
        style={{ background: "#ffffff", opacity: flash, pointerEvents: "none" }}
      />

      <Caption
        kicker="it arrives"
        lines={[
          "It doesn't fly in or land.",
          "It simply rotates into view — from a direction we can't point to.",
        ]}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 3 — Appear & Vanish                                         */
/* ------------------------------------------------------------------ */
const Creature: React.FC<{ presence: number; cx?: number; cy?: number; s?: number }> = ({
  presence,
  cx = 960,
  cy = 430,
  s = 1,
}) => {
  const frame = useCurrentFrame();
  const breathe = 1 + 0.04 * Math.sin(frame / 8);
  return (
    <svg
      width="1920"
      height="1080"
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <radialGradient id="body" cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="35%" stopColor={CYAN} stopOpacity="0.9" />
          <stop offset="70%" stopColor={VIOLET} stopOpacity="0.7" />
          <stop offset="100%" stopColor={MAGENTA} stopOpacity="0" />
        </radialGradient>
        <filter id="cglow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="10" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g
        opacity={presence}
        filter="url(#cglow)"
        transform={`translate(${cx} ${cy}) scale(${s * (0.6 + presence * 0.4) * breathe})`}
      >
        {/* tentacle-like cross-sections of a higher-D body */}
        {Array.from({ length: 7 }).map((_, i) => {
          const ang = (i / 7) * Math.PI * 2 + frame / 40;
          const r = 70 + 30 * Math.sin(frame / 12 + i);
          const x = Math.cos(ang) * r;
          const y = Math.sin(ang) * r * 0.7;
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={20 + 10 * Math.sin(frame / 9 + i * 2)}
              fill={i % 2 ? VIOLET : CYAN}
              opacity={0.5}
            />
          );
        })}
        <circle cx={0} cy={0} r={120} fill="url(#body)" />
        {/* eye */}
        <circle cx={0} cy={-6} r={26} fill={VOID} opacity={0.9} />
        <circle cx={0} cy={-6} r={12} fill={GOLD} />
      </g>
    </svg>
  );
};

const VanishScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 14);
  // presence dips toward 0 (lifting out of 3D) then returns
  const presence = interpolate(
    frame,
    [0, 30, 70, 100, 140, 170, 200],
    [0, 1, 1, 0.05, 0.05, 1, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  // a faint "shadow" remains when it lifts out
  const ghost = interpolate(frame, [70, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 42%, ${BG_2} 0%, ${BG} 65%, ${VOID} 100%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={60} opacity={0.5} />
      {/* the floor / our 3D slice */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 640,
          height: 4,
          background: `linear-gradient(90deg, transparent, ${CYAN}66, transparent)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 600,
          width: 400,
          height: 80,
          borderRadius: "50%",
          background: "#000",
          opacity: 0.35 * (1 - ghost * 0.7) * (0.4 + presence),
          filter: "blur(18px)",
        }}
      />
      <Creature presence={presence} />
      <Caption
        kicker="appear · vanish"
        lines={[
          "To us it blinks out of existence.",
          "Really it just steps off our 3D slice — still right beside us.",
        ]}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 4 — Reach inside a sealed box                               */
/* ------------------------------------------------------------------ */
const SealedBoxScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 14);

  // The gem starts inside the closed box, then is lifted "out" through 4D
  const lift = interpolate(frame, [60, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gemY = interpolate(lift, [0, 1], [470, 250]);
  const gemInsideOp = interpolate(frame, [0, 20, 60, 80], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const gemOutOp = interpolate(frame, [70, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const reach = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const boxCx = 960;
  const boxTop = 380;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${BG_2} 0%, ${BG} 70%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={40} opacity={0.4} />
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <linearGradient id="boxFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a3566" />
            <stop offset="100%" stopColor="#161d3d" />
          </linearGradient>
          <radialGradient id="gem" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="45%" stopColor={GOLD} />
            <stop offset="100%" stopColor="#c98a1a" />
          </radialGradient>
          <filter id="gemglow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* gem still sealed inside (seen through "impossible" view) */}
        <g opacity={gemInsideOp} filter="url(#gemglow)">
          <circle cx={boxCx} cy={470} r={42} fill="url(#gem)" />
        </g>

        {/* 4D hand: a glowing probe that bypasses the walls */}
        <g opacity={reach}>
          <path
            d={`M ${boxCx} 120 Q ${boxCx + 60} 300 ${boxCx} ${gemY}`}
            stroke={CYAN}
            strokeWidth={6}
            fill="none"
            opacity={0.7}
            strokeLinecap="round"
          />
          <circle cx={boxCx} cy={gemY} r={16} fill={CYAN} opacity={0.5} />
        </g>

        {/* the closed box (drawn AFTER gem-inside so walls overlap it; box stays sealed) */}
        <g>
          {/* back-top rim to imply 3D */}
          <polygon
            points={`${boxCx - 150},${boxTop} ${boxCx - 90},${boxTop - 45} ${boxCx + 210},${boxTop - 45} ${boxCx + 150},${boxTop}`}
            fill="#1f284f"
          />
          <polygon
            points={`${boxCx + 150},${boxTop} ${boxCx + 210},${boxTop - 45} ${boxCx + 210},${boxTop + 175} ${boxCx + 150},${boxTop + 220}`}
            fill="#141a38"
          />
          {/* front face */}
          <rect
            x={boxCx - 150}
            y={boxTop}
            width={300}
            height={220}
            rx={8}
            fill="url(#boxFace)"
            stroke={VIOLET}
            strokeWidth={2}
            opacity={0.96}
          />
          {/* lid seam to show it is CLOSED */}
          <line
            x1={boxCx - 150}
            y1={boxTop + 6}
            x2={boxCx + 150}
            y2={boxTop + 6}
            stroke={VIOLET}
            strokeWidth={3}
            opacity={0.8}
          />
          <rect
            x={boxCx - 16}
            y={boxTop + 90}
            width={32}
            height={40}
            rx={4}
            fill={GOLD}
            opacity={0.5}
          />
        </g>

        {/* gem now lifted OUT, above the still-sealed box */}
        <g opacity={gemOutOp} filter="url(#gemglow)">
          <circle cx={boxCx} cy={gemY} r={46} fill="url(#gem)" />
          {Array.from({ length: 8 }).map((_, i) => {
            const a = (i / 8) * Math.PI * 2 + frame / 20;
            return (
              <circle
                key={i}
                cx={boxCx + Math.cos(a) * 70}
                cy={gemY + Math.sin(a) * 70}
                r={3}
                fill={GOLD}
                opacity={0.7}
              />
            );
          })}
        </g>
      </svg>

      <Caption
        kicker="through sealed walls"
        lines={[
          "It lifts the gem out of a locked box — without opening it.",
          "From 4D, our 'inside' is as open as the top of a drawn square.",
        ]}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 5 — Mirror flip (turn an object into its reflection)        */
/* ------------------------------------------------------------------ */
const Hand: React.FC<{ flip: number; cx: number; cy: number; label: string }> = ({
  flip,
  cx,
  cy,
  label,
}) => {
  return (
    <g transform={`translate(${cx} ${cy}) scale(${flip}, 1)`}>
      <g>
        {/* palm */}
        <rect x={-55} y={-30} width={110} height={130} rx={28} fill={VIOLET} opacity={0.9} />
        {/* fingers */}
        {[-40, -14, 12, 38].map((fx, i) => (
          <rect
            key={i}
            x={fx - 9}
            y={-95 - (i === 1 || i === 2 ? 18 : 0)}
            width={18}
            height={75 + (i === 1 || i === 2 ? 18 : 0)}
            rx={9}
            fill={CYAN}
            opacity={0.85}
          />
        ))}
        {/* thumb — the chirality marker */}
        <rect
          x={50}
          y={0}
          width={60}
          height={20}
          rx={10}
          fill={MAGENTA}
          opacity={0.95}
          transform="rotate(35 50 0)"
        />
      </g>
    </g>
  );
};

const MirrorScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 14);
  // a single hand flips through 4D from right-handed to left-handed
  const flip = interpolate(
    frame,
    [50, 90, 110],
    [1, 0.02, -1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const spinOp = interpolate(frame, [70, 95], [1, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const settle = interpolate(frame, [110, 130], [0.2, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelLeftOp = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const labelRightOp = interpolate(frame, [10, 30, 70, 90], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${BG_2} 0%, ${BG} 70%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={40} opacity={0.4} />
      <svg
        width="1920"
        height="1080"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
        opacity={Math.max(spinOp, settle)}
      >
        <Hand flip={flip} cx={960} cy={400} label="hand" />
      </svg>
      <div
        style={{
          position: "absolute",
          top: 540,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 30,
          color: GOLD,
        }}
      >
        <span style={{ opacity: labelRightOp }}>right hand</span>
        <span style={{ opacity: labelLeftOp }}>left hand</span>
      </div>
      <Caption
        kicker="mirror worlds"
        lines={[
          "A simple twist through the 4th direction…",
          "and a right hand comes back left — its perfect mirror image.",
        ]}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 6 — See every inside at once                                */
/* ------------------------------------------------------------------ */
const XRayScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 14);
  const reveal = interpolate(frame, [30, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scan = interpolate(frame % 70, [0, 70], [0, 1]);

  const objs = [
    { x: 520, label: "the safe", inner: "★" },
    { x: 960, label: "the body", inner: "♥" },
    { x: 1400, label: "the seed", inner: "✦" },
  ];

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${BG_2} 0%, ${BG} 70%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={40} opacity={0.4} />
      {objs.map((o, i) => {
        const appear = interpolate(frame, [i * 10, i * 10 + 20], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div
            key={o.label}
            style={{
              position: "absolute",
              left: o.x - 130,
              top: 280,
              width: 260,
              height: 260,
              opacity: appear,
            }}
          >
            {/* opaque shell */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 28,
                background: `linear-gradient(160deg, #2a3566, #141a38)`,
                border: `2px solid ${VIOLET}`,
                opacity: 1 - reveal * 0.78,
              }}
            />
            {/* revealed interior */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 28,
                border: `2px dashed ${CYAN}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: GOLD,
                fontSize: 120,
                opacity: reveal,
                textShadow: `0 0 30px ${GOLD}`,
              }}
            >
              {o.inner}
            </div>
            <div
              style={{
                position: "absolute",
                bottom: -44,
                left: 0,
                right: 0,
                textAlign: "center",
                color: TEXT_DIM,
                fontSize: 24,
                fontFamily: MONO,
              }}
            >
              {o.label}
            </div>
          </div>
        );
      })}
      {/* scanning beam */}
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: `${10 + scan * 80}%`,
          width: 3,
          background: `linear-gradient(${CYAN}, transparent)`,
          opacity: reveal * 0.6,
        }}
      />
      <Caption
        kicker="nothing is hidden"
        lines={[
          "Every inside is laid bare at once —",
          "the locked safe, the living heart, the sealed seed.",
        ]}
      />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  SCENE 7 — Outro                                                   */
/* ------------------------------------------------------------------ */
const OutroScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const op = useFade(0, durationInFrames, 18);
  const titleOp = interpolate(frame, [16, 40], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [44, 70], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 45%, ${BG_2} 0%, ${BG} 60%, ${VOID} 100%)`,
        fontFamily: FONT,
        opacity: op,
      }}
    >
      <Stars count={140} />
      <div style={{ opacity: 0.5 }}>
        <Tesseract scale={120} speed={0.7} glow={1} cy={430} />
      </div>
      <AbsoluteFill
        style={{
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-end",
          paddingBottom: 170,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: TEXT,
            letterSpacing: -2,
            textAlign: "center",
            opacity: titleOp,
            lineHeight: 1.1,
            textShadow: `0 0 50px ${VIOLET}55`,
          }}
        >
          To them, our walls have no lids.
        </div>
        <div
          style={{
            fontSize: 30,
            color: TEXT_DIM,
            letterSpacing: 3,
            opacity: subOp,
            marginTop: 24,
            textAlign: "center",
          }}
        >
          we are the flat drawings — they hold the page
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/*  ROOT COMPOSITION                                                  */
/* ------------------------------------------------------------------ */
export const SCENE_DURATIONS = {
  title: 120,
  arrival: 200,
  vanish: 210,
  box: 220,
  mirror: 200,
  xray: 210,
  outro: 180,
};

export const FOURTH_DIMENSION_DURATION = Object.values(SCENE_DURATIONS).reduce(
  (a, b) => a + b,
  0,
);

export const FourthDimension: React.FC = () => {
  const d = SCENE_DURATIONS;
  let at = 0;
  const seq = (dur: number) => {
    const from = at;
    at += dur;
    return { from, durationInFrames: dur };
  };
  const s1 = seq(d.title);
  const s2 = seq(d.arrival);
  const s3 = seq(d.vanish);
  const s4 = seq(d.box);
  const s5 = seq(d.mirror);
  const s6 = seq(d.xray);
  const s7 = seq(d.outro);

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence from={s1.from} durationInFrames={s1.durationInFrames}>
        <TitleScene durationInFrames={s1.durationInFrames} />
      </Sequence>
      <Sequence from={s2.from} durationInFrames={s2.durationInFrames}>
        <ArrivalScene durationInFrames={s2.durationInFrames} />
      </Sequence>
      <Sequence from={s3.from} durationInFrames={s3.durationInFrames}>
        <VanishScene durationInFrames={s3.durationInFrames} />
      </Sequence>
      <Sequence from={s4.from} durationInFrames={s4.durationInFrames}>
        <SealedBoxScene durationInFrames={s4.durationInFrames} />
      </Sequence>
      <Sequence from={s5.from} durationInFrames={s5.durationInFrames}>
        <MirrorScene durationInFrames={s5.durationInFrames} />
      </Sequence>
      <Sequence from={s6.from} durationInFrames={s6.durationInFrames}>
        <XRayScene durationInFrames={s6.durationInFrames} />
      </Sequence>
      <Sequence from={s7.from} durationInFrames={s7.durationInFrames}>
        <OutroScene durationInFrames={s7.durationInFrames} />
      </Sequence>
    </AbsoluteFill>
  );
};
