import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
  random,
} from "remotion";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI Variable', 'Inter', system-ui, sans-serif";

const COLORS = {
  bgA: "#0a0612",
  bgB: "#1a0f24",
  bgC: "#2a1a3d",
  neonPink: "#ff5cb8",
  neonCyan: "#5ce1ff",
  neonViolet: "#a070ff",
  pastelPeach: "#ffd4c4",
  pastelMint: "#c4f0e0",
  text: "#f6f1ff",
  textDim: "#b9aecb",
  surface: "rgba(255,255,255,0.06)",
  surfaceStrong: "rgba(255,255,255,0.12)",
  good: "#5cffb8",
  bad: "#ff6b8a",
};

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const useFade = (inFrame: number, outFrame: number, hold = 14) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [inFrame, inFrame + hold], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const b = interpolate(f, [outFrame - hold, outFrame], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return Math.min(a, b);
};

const Backdrop: React.FC<{ tone?: "violet" | "rose" | "mint" }> = ({
  tone = "violet",
}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 300], [0, 30]);
  const palettes = {
    violet: ["#0a0612", "#1a0f24", "#3a1f55"],
    rose: ["#0d0710", "#2a0f1e", "#55203f"],
    mint: ["#06120f", "#0f2422", "#1e5546"],
  } as const;
  const [a, b, c] = palettes[tone];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 30% 20%, ${c} 0%, ${b} 40%, ${a} 80%)`,
        transform: `scale(1.05) rotate(${drift * 0.05}deg)`,
      }}
    />
  );
};

const Particles: React.FC<{ count?: number; seed?: string }> = ({
  count = 40,
  seed = "p",
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {new Array(count).fill(0).map((_, i) => {
        const baseX = random(`${seed}x${i}`) * width;
        const baseY = random(`${seed}y${i}`) * height;
        const speed = 0.3 + random(`${seed}s${i}`) * 0.7;
        const size = 1 + random(`${seed}sz${i}`) * 3;
        const drift = Math.sin((frame / 40 + i) * speed) * 30;
        const op =
          0.3 +
          0.5 *
            Math.abs(
              Math.sin((frame / 30 + random(`${seed}o${i}`) * 6) * speed),
            );
        const hue = random(`${seed}h${i}`) > 0.5 ? COLORS.neonPink : COLORS.neonCyan;
        void durationInFrames;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: baseX + drift,
              top: baseY + drift * 0.5,
              width: size,
              height: size,
              borderRadius: size,
              background: hue,
              boxShadow: `0 0 ${size * 4}px ${hue}`,
              opacity: op,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

const Phone: React.FC<{
  children: React.ReactNode;
  rotateY?: number;
  scale?: number;
  glow?: number;
}> = ({ children, rotateY = 0, scale = 1, glow = 1 }) => {
  return (
    <div
      style={{
        position: "relative",
        width: 460,
        height: 940,
        borderRadius: 60,
        background: "linear-gradient(160deg, #1a1325 0%, #0a0612 100%)",
        boxShadow: `
          inset 0 0 0 2px rgba(255,255,255,0.08),
          inset 0 0 0 8px #0a0612,
          0 40px 80px rgba(0,0,0,0.6),
          0 0 ${80 * glow}px rgba(255,92,184,${0.25 * glow}),
          0 0 ${120 * glow}px rgba(92,225,255,${0.18 * glow})
        `,
        transform: `perspective(2000px) rotateY(${rotateY}deg) scale(${scale})`,
        transformStyle: "preserve-3d",
        padding: 14,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 22,
          left: "50%",
          transform: "translateX(-50%)",
          width: 110,
          height: 28,
          background: "#000",
          borderRadius: 16,
          zIndex: 10,
        }}
      />
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 48,
          overflow: "hidden",
          background: "#0a0612",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};

const PhoneCenter: React.FC<{
  children: React.ReactNode;
  rotateY?: number;
  scale?: number;
  glow?: number;
}> = (props) => (
  <AbsoluteFill
    style={{
      justifyContent: "center",
      alignItems: "center",
      fontFamily: FONT,
    }}
  >
    <Phone {...props}>{props.children}</Phone>
  </AbsoluteFill>
);

const StatusBar: React.FC = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "18px 36px 6px",
      color: COLORS.text,
      fontSize: 16,
      fontWeight: 600,
    }}
  >
    <div>9:41</div>
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div style={{ width: 18, height: 10, border: `1.5px solid ${COLORS.text}`, borderRadius: 2 }} />
    </div>
  </div>
);

// ============ Scene 1: App Opening ============
const Scene1Opening: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(0, durationInFrames, 18);

  const iconScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 90, mass: 0.8 },
  });
  const pulse = 1 + Math.sin(frame / 8) * 0.04;
  const iconOnly = interpolate(frame, [60, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const uiReveal = interpolate(frame, [70, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const tagline = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="violet" />
      <Particles count={50} seed="s1" />
      <PhoneCenter scale={iconScale}>
        <StatusBar />
        {/* App icon centered while opening */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: iconOnly,
          }}
        >
          <div
            style={{
              width: 140,
              height: 140,
              borderRadius: 38,
              background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonViolet})`,
              boxShadow: `0 0 60px ${COLORS.neonPink}`,
              transform: `scale(${pulse})`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 70,
            }}
          >
            <span style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.4))" }}>✦</span>
          </div>
        </div>
        {/* UI expanding */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: uiReveal,
            padding: "60px 28px",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <div
            style={{
              color: COLORS.text,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            Good morning,
            <div style={{ color: COLORS.neonPink }}>Aria ✦</div>
          </div>
          {[
            { t: "Today's skin score", v: "87", c: COLORS.neonCyan },
            { t: "Hydration", v: "Good", c: COLORS.pastelMint },
            { t: "Logged products", v: "12", c: COLORS.pastelPeach },
          ].map((card, i) => (
            <div
              key={i}
              style={{
                background: COLORS.surface,
                backdropFilter: "blur(10px)",
                borderRadius: 22,
                padding: 18,
                border: `1px solid rgba(255,255,255,0.08)`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transform: `translateY(${(1 - uiReveal) * 30}px)`,
              }}
            >
              <div style={{ color: COLORS.textDim, fontSize: 16 }}>{card.t}</div>
              <div style={{ color: card.c, fontSize: 22, fontWeight: 700 }}>
                {card.v}
              </div>
            </div>
          ))}
        </div>
      </PhoneCenter>
      <div
        style={{
          position: "absolute",
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLORS.text,
          fontFamily: FONT,
          fontSize: 56,
          fontWeight: 300,
          letterSpacing: 8,
          opacity: tagline,
          textShadow: `0 0 24px ${COLORS.neonPink}`,
        }}
      >
        Scan · Analyze · Improve
      </div>
    </AbsoluteFill>
  );
};

// ============ Scene 2: Product Scanner ============
const Scene2Scanner: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = useFade(0, durationInFrames, 16);

  const scanLineY = interpolate(frame, [10, 90], [0, 700], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ingredientReveal = (i: number) =>
    interpolate(frame, [110 + i * 14, 130 + i * 14], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  const ratingReveal = interpolate(frame, [220, 250], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const ingredients = [
    { name: "Niacinamide", safe: true, note: "brightens" },
    { name: "Salicylic Acid", safe: true, note: "exfoliates" },
    { name: "Fragrance", safe: false, note: "irritant" },
    { name: "Hyaluronic Acid", safe: true, note: "hydrates" },
    { name: "Denatured Alcohol", safe: false, note: "drying" },
  ];

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="rose" />
      <Particles count={35} seed="s2" />
      <PhoneCenter>
        <StatusBar />
        <div style={{ padding: "8px 24px", color: COLORS.text }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Scan product</div>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>
            point camera at the label
          </div>
        </div>
        {/* Camera viewport */}
        <div
          style={{
            margin: "12px 18px",
            height: 360,
            borderRadius: 24,
            background:
              "linear-gradient(160deg, #2a1f30, #1a1020), radial-gradient(circle at 50% 60%, #ffd4c4 0%, #f0a890 60%, #2a1f30 100%)",
            position: "relative",
            overflow: "hidden",
            border: `1px solid ${COLORS.surfaceStrong}`,
          }}
        >
          {/* product bottle silhouette */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 120,
              height: 220,
              borderRadius: "30px 30px 18px 18px",
              background:
                "linear-gradient(170deg, #f8e7d8 0%, #ddc4b2 100%)",
              boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 22,
                left: 12,
                right: 12,
                height: 10,
                background: "#3a2a45",
                borderRadius: 2,
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 50,
                left: 12,
                right: 12,
                fontSize: 9,
                color: "#5a4a55",
                lineHeight: 1.3,
              }}
            >
              GLOW SERUM
              <div style={{ marginTop: 6, fontSize: 6 }}>
                Niacinamide · Salicylic
                <br />
                Hyaluronic · 30ml
              </div>
            </div>
          </div>
          {/* corner brackets */}
          {[
            { t: 12, l: 12, b: "auto", r: "auto", r1: 4, r2: 0, r3: 0, r4: 0 },
            { t: 12, r: 12, b: "auto", l: "auto", r1: 0, r2: 4, r3: 0, r4: 0 },
            { b: 12, l: 12, t: "auto", r: "auto", r1: 0, r2: 0, r3: 0, r4: 4 },
            { b: 12, r: 12, t: "auto", l: "auto", r1: 0, r2: 0, r3: 4, r4: 0 },
          ].map((c, i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                top: c.t as number | string,
                left: c.l as number | string,
                right: c.r as number | string,
                bottom: c.b as number | string,
                width: 28,
                height: 28,
                borderTop: i < 2 ? `3px solid ${COLORS.neonCyan}` : "none",
                borderBottom: i >= 2 ? `3px solid ${COLORS.neonCyan}` : "none",
                borderLeft: i % 2 === 0 ? `3px solid ${COLORS.neonCyan}` : "none",
                borderRight: i % 2 === 1 ? `3px solid ${COLORS.neonCyan}` : "none",
                borderTopLeftRadius: c.r1,
                borderTopRightRadius: c.r2,
                borderBottomRightRadius: c.r3,
                borderBottomLeftRadius: c.r4,
              }}
            />
          ))}
          {/* scan line */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: scanLineY * 0.5,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${COLORS.neonCyan}, transparent)`,
              boxShadow: `0 0 18px ${COLORS.neonCyan}`,
            }}
          />
        </div>
        {/* Ingredient list */}
        <div
          style={{
            padding: "12px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {ingredients.map((ing, i) => {
            const op = ingredientReveal(i);
            return (
              <div
                key={ing.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: COLORS.surface,
                  borderRadius: 14,
                  padding: "10px 14px",
                  opacity: op,
                  transform: `translateX(${(1 - op) * -20}px)`,
                }}
              >
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ color: COLORS.text, fontSize: 14, fontWeight: 600 }}>
                    {ing.name}
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                    {ing.note}
                  </div>
                </div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    background: ing.safe ? COLORS.good : COLORS.bad,
                    color: "#0a0612",
                    fontWeight: 900,
                    fontSize: 18,
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    boxShadow: `0 0 14px ${ing.safe ? COLORS.good : COLORS.bad}`,
                  }}
                >
                  {ing.safe ? "✓" : "✕"}
                </div>
              </div>
            );
          })}
        </div>
        {/* Final rating */}
        <div
          style={{
            margin: "8px 22px",
            padding: 16,
            borderRadius: 18,
            background: `linear-gradient(135deg, rgba(92,255,184,0.18), rgba(255,107,138,0.08))`,
            border: `1px solid rgba(92,255,184,0.4)`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            opacity: ratingReveal,
            transform: `scale(${0.9 + ratingReveal * 0.1})`,
          }}
        >
          <div>
            <div style={{ color: COLORS.textDim, fontSize: 12 }}>Verdict</div>
            <div style={{ color: COLORS.good, fontSize: 24, fontWeight: 800 }}>
              YES — mostly safe
            </div>
          </div>
          <div
            style={{
              fontSize: 28,
              color: COLORS.good,
              textShadow: `0 0 12px ${COLORS.good}`,
            }}
          >
            ✓
          </div>
        </div>
      </PhoneCenter>
      <SceneTitle text="Product scanner" subtitle="ingredients, decoded" />
    </AbsoluteFill>
  );
};

// ============ Scene 3: Face Scan ============
const Scene3FaceScan: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = useFade(0, durationInFrames, 16);

  // Animated mesh lines
  const meshOpacity = interpolate(frame, [20, 70], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ringPulse = (frame % 60) / 60;
  const ringScale = 1 + ringPulse * 0.4;
  const ringOp = 1 - ringPulse;

  const metricsReveal = (i: number) =>
    interpolate(frame, [120 + i * 12, 140 + i * 12], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  const graphProgress = interpolate(frame, [180, 260], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="violet" />
      <Particles count={35} seed="s3" />
      <PhoneCenter>
        <StatusBar />
        <div style={{ padding: "8px 24px", color: COLORS.text }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Face analysis</div>
          <div style={{ fontSize: 13, color: COLORS.textDim }}>
            hold still while we scan
          </div>
        </div>
        {/* Face mesh viewport */}
        <div
          style={{
            margin: "12px 18px",
            height: 380,
            borderRadius: 24,
            background:
              "radial-gradient(circle at 50% 45%, #3a2540 0%, #1a0f24 80%)",
            position: "relative",
            overflow: "hidden",
            border: `1px solid ${COLORS.surfaceStrong}`,
          }}
        >
          {/* face silhouette */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: 200,
              height: 260,
              borderRadius: "50% 50% 45% 45%",
              background:
                "radial-gradient(ellipse at 50% 40%, #f0c4b0 0%, #c89880 70%, #6a4838 100%)",
              filter: "blur(0.5px)",
              boxShadow: `inset 0 -30px 60px rgba(0,0,0,0.4)`,
            }}
          />
          {/* mesh dots overlay */}
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0, opacity: meshOpacity }}
            viewBox="0 0 400 380"
          >
            {new Array(28).fill(0).map((_, i) => {
              const angle = (i / 28) * Math.PI * 2;
              const r = 60 + (i % 4) * 25;
              const cx = 200 + Math.cos(angle) * r;
              const cy = 190 + Math.sin(angle) * r * 1.2;
              return (
                <g key={i}>
                  <circle cx={cx} cy={cy} r={2.5} fill={COLORS.neonCyan} />
                  {i > 0 && (
                    <line
                      x1={cx}
                      y1={cy}
                      x2={200 + Math.cos(((i - 1) / 28) * Math.PI * 2) * (60 + ((i - 1) % 4) * 25)}
                      y2={190 + Math.sin(((i - 1) / 28) * Math.PI * 2) * (60 + ((i - 1) % 4) * 25) * 1.2}
                      stroke={COLORS.neonCyan}
                      strokeOpacity={0.3}
                      strokeWidth={1}
                    />
                  )}
                </g>
              );
            })}
          </svg>
          {/* pulse ring */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 240,
              height: 320,
              borderRadius: "50%",
              border: `2px solid ${COLORS.neonPink}`,
              transform: `translate(-50%, -50%) scale(${ringScale})`,
              opacity: ringOp * 0.8,
            }}
          />
          {/* analyzing label */}
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 14,
              padding: "6px 12px",
              background: "rgba(0,0,0,0.5)",
              borderRadius: 12,
              color: COLORS.neonCyan,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 1,
            }}
          >
            ● ANALYZING
          </div>
        </div>
        {/* metrics */}
        <div
          style={{
            padding: "8px 22px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
          }}
        >
          {[
            { label: "Acne", val: "Low", c: COLORS.good },
            { label: "Redness", val: "Mild", c: COLORS.pastelPeach },
            { label: "Texture", val: "Smooth", c: COLORS.good },
            { label: "Hydration", val: "68%", c: COLORS.neonCyan },
          ].map((m, i) => {
            const op = metricsReveal(i);
            return (
              <div
                key={m.label}
                style={{
                  background: COLORS.surface,
                  borderRadius: 14,
                  padding: "8px 12px",
                  opacity: op,
                  transform: `translateY(${(1 - op) * 10}px)`,
                }}
              >
                <div style={{ color: COLORS.textDim, fontSize: 11 }}>{m.label}</div>
                <div style={{ color: m.c, fontSize: 18, fontWeight: 700 }}>
                  {m.val}
                </div>
              </div>
            );
          })}
        </div>
        {/* progress graph */}
        <div
          style={{
            margin: "10px 22px",
            padding: 14,
            borderRadius: 18,
            background: COLORS.surface,
            opacity: graphProgress,
          }}
        >
          <div
            style={{
              color: COLORS.textDim,
              fontSize: 11,
              marginBottom: 8,
            }}
          >
            Projected improvement
          </div>
          <svg width="100%" height="60" viewBox="0 0 380 60">
            <defs>
              <linearGradient id="ggrad" x1="0" x2="1">
                <stop offset="0" stopColor={COLORS.neonPink} />
                <stop offset="1" stopColor={COLORS.neonCyan} />
              </linearGradient>
            </defs>
            <polyline
              points={`0,50 95,42 ${190 * graphProgress + (1 - graphProgress) * 95},${42 - 18 * graphProgress} ${285 * graphProgress + (1 - graphProgress) * 95},${30 - 18 * graphProgress} ${380 * graphProgress + (1 - graphProgress) * 95},${12 - 8 * graphProgress}`}
              fill="none"
              stroke="url(#ggrad)"
              strokeWidth="3"
              strokeLinecap="round"
            />
            {[
              { x: 0, label: "Day 1" },
              { x: 190, label: "Day 14" },
              { x: 376, label: "Day 30" },
            ].map((d) => (
              <text
                key={d.label}
                x={d.x}
                y={58}
                fill={COLORS.textDim}
                fontSize="10"
                textAnchor={d.x === 0 ? "start" : d.x > 300 ? "end" : "middle"}
                fontFamily={FONT}
              >
                {d.label}
              </text>
            ))}
          </svg>
        </div>
      </PhoneCenter>
      <SceneTitle text="Face scan" subtitle="acne · redness · texture" />
    </AbsoluteFill>
  );
};

// ============ Scene 4: Smart Coach Chat ============
const Scene4Chat: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = useFade(0, durationInFrames, 16);

  const userMsg = "I got a pimple. What should I do?";
  const userCharsShown = Math.floor(
    interpolate(frame, [20, 90], [0, userMsg.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const userBubbleOp = interpolate(frame, [90, 110], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typingDotsShow = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typingDotsHide = interpolate(frame, [170, 185], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typingOp = Math.min(typingDotsShow, typingDotsHide);

  const reply =
    "You already have a pimple patch in your logged products. Use that instead of buying a new one.";
  const replyCharsShown = Math.floor(
    interpolate(frame, [190, 260], [0, reply.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const replyBubbleOp = interpolate(frame, [185, 200], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const dotPhase = (i: number) =>
    0.4 + 0.6 * Math.abs(Math.sin((frame / 6 + i * 0.7) % Math.PI));

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="violet" />
      <Particles count={30} seed="s4" />
      <PhoneCenter>
        <StatusBar />
        <div
          style={{
            padding: "8px 24px 0",
            color: COLORS.text,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonViolet})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 0 16px ${COLORS.neonPink}80`,
            }}
          >
            ✦
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Aria Coach</div>
            <div style={{ fontSize: 11, color: COLORS.good }}>● online</div>
          </div>
        </div>
        <div
          style={{
            padding: "20px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flex: 1,
          }}
        >
          {/* user message */}
          <div
            style={{
              alignSelf: "flex-end",
              maxWidth: "82%",
              background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonViolet})`,
              color: COLORS.text,
              padding: "12px 16px",
              borderRadius: 20,
              borderBottomRightRadius: 6,
              fontSize: 15,
              lineHeight: 1.35,
              opacity: userBubbleOp,
              boxShadow: `0 4px 18px rgba(255,92,184,0.3)`,
            }}
          >
            {userMsg.slice(0, userCharsShown)}
            {userCharsShown < userMsg.length && (
              <span style={{ opacity: (frame % 20) < 10 ? 1 : 0 }}>|</span>
            )}
          </div>
          {/* typing dots */}
          <div
            style={{
              alignSelf: "flex-start",
              background: COLORS.surfaceStrong,
              padding: "12px 18px",
              borderRadius: 20,
              borderBottomLeftRadius: 6,
              display: "flex",
              gap: 6,
              opacity: typingOp,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  background: COLORS.neonCyan,
                  opacity: dotPhase(i),
                }}
              />
            ))}
          </div>
          {/* reply */}
          <div
            style={{
              alignSelf: "flex-start",
              maxWidth: "82%",
              background: COLORS.surfaceStrong,
              color: COLORS.text,
              padding: "12px 16px",
              borderRadius: 20,
              borderBottomLeftRadius: 6,
              fontSize: 15,
              lineHeight: 1.4,
              opacity: replyBubbleOp,
              border: `1px solid rgba(92,225,255,0.3)`,
              boxShadow: `0 4px 18px rgba(92,225,255,0.18)`,
            }}
          >
            {reply.slice(0, replyCharsShown)}
            {replyCharsShown < reply.length && replyCharsShown > 0 && (
              <span style={{ opacity: (frame % 20) < 10 ? 1 : 0 }}>|</span>
            )}
          </div>
        </div>
        {/* input bar */}
        <div
          style={{
            padding: 14,
            margin: "0 16px 18px",
            background: COLORS.surface,
            borderRadius: 24,
            color: COLORS.textDim,
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div style={{ flex: 1 }}>Ask Aria…</div>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              background: COLORS.neonPink,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0a0612",
              fontWeight: 800,
            }}
          >
            ↑
          </div>
        </div>
      </PhoneCenter>
      <SceneTitle text="Smart coach" subtitle="answers in context" />
    </AbsoluteFill>
  );
};

// ============ Scene 5: Routine Generator ============
const Scene5Routine: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = useFade(0, durationInFrames, 16);

  const steps = [
    { i: 1, name: "Cleanser", note: "gentle foam", c: COLORS.neonCyan, emo: "❍" },
    { i: 2, name: "Niacinamide", note: "10% serum", c: COLORS.neonPink, emo: "✦" },
    { i: 3, name: "Moisturizer", note: "ceramide cream", c: COLORS.pastelMint, emo: "◐" },
  ];

  const stepReveal = (i: number) =>
    interpolate(frame, [40 + i * 30, 70 + i * 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="mint" />
      <Particles count={32} seed="s5" />
      <PhoneCenter>
        <StatusBar />
        <div style={{ padding: "8px 24px", color: COLORS.text }}>
          <div style={{ fontSize: 13, color: COLORS.textDim, letterSpacing: 2 }}>
            TONIGHT
          </div>
          <div style={{ fontSize: 26, fontWeight: 700 }}>Your routine</div>
        </div>
        <div
          style={{
            padding: "18px 22px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            flex: 1,
          }}
        >
          {steps.map((s, i) => {
            const op = stepReveal(i);
            const glow = Math.max(0, Math.sin((frame - 40 - i * 30) / 14)) * 0.6;
            return (
              <div
                key={s.name}
                style={{
                  background: COLORS.surface,
                  borderRadius: 22,
                  padding: 16,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  opacity: op,
                  transform: `translateX(${(1 - op) * -24}px)`,
                  border: `1px solid ${s.c}40`,
                  boxShadow: `0 0 ${24 * glow * op}px ${s.c}50`,
                }}
              >
                <div
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    background: `linear-gradient(135deg, ${s.c}, ${s.c}80)`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 24,
                    color: "#0a0612",
                    fontWeight: 800,
                    boxShadow: `0 0 24px ${s.c}80`,
                  }}
                >
                  {s.emo}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      color: COLORS.textDim,
                      fontSize: 11,
                      letterSpacing: 1,
                    }}
                  >
                    STEP {s.i}
                  </div>
                  <div
                    style={{
                      color: COLORS.text,
                      fontSize: 18,
                      fontWeight: 700,
                    }}
                  >
                    {s.name}
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 12 }}>
                    {s.note}
                  </div>
                </div>
                <div
                  style={{
                    color: s.c,
                    fontSize: 22,
                    textShadow: `0 0 8px ${s.c}`,
                  }}
                >
                  →
                </div>
              </div>
            );
          })}
          <div
            style={{
              marginTop: "auto",
              padding: "12px 16px",
              background: `linear-gradient(135deg, ${COLORS.neonPink}30, ${COLORS.neonCyan}20)`,
              borderRadius: 18,
              border: `1px solid ${COLORS.neonPink}40`,
              color: COLORS.text,
              fontSize: 13,
              opacity: interpolate(frame, [160, 190], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            ⏱  3 min · uses what you already own
          </div>
        </div>
      </PhoneCenter>
      <SceneTitle text="Daily routine" subtitle="generated for tonight" />
    </AbsoluteFill>
  );
};

// ============ Scene 6: Budget Recommendations ============
const Scene6Budget: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const opacity = useFade(0, durationInFrames, 16);

  const products = [
    {
      name: "Vitamin C Serum",
      price: "$18",
      purpose: "brightening",
      why: "your face scan shows uneven tone",
      alt: "you own: niacinamide (similar)",
      c: COLORS.pastelPeach,
    },
    {
      name: "SPF 50 Sunscreen",
      price: "$12",
      purpose: "daily UV protection",
      why: "missing from current routine",
      alt: null,
      c: COLORS.neonCyan,
    },
    {
      name: "Retinol 0.3%",
      price: "$24",
      purpose: "texture · fine lines",
      why: "matches Day 30 goal",
      alt: "you own: bakuchiol (gentle alt)",
      c: COLORS.neonPink,
    },
  ];

  const cardReveal = (i: number) =>
    interpolate(frame, [30 + i * 26, 60 + i * 26], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="rose" />
      <Particles count={28} seed="s6" />
      <PhoneCenter>
        <StatusBar />
        <div
          style={{
            padding: "8px 22px",
            color: COLORS.text,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <div>
            <div style={{ fontSize: 13, color: COLORS.textDim, letterSpacing: 2 }}>
              FOR YOU
            </div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Smart shopping</div>
          </div>
          <div
            style={{
              fontSize: 12,
              color: COLORS.neonCyan,
              background: COLORS.surface,
              padding: "6px 10px",
              borderRadius: 12,
            }}
          >
            budget · $60
          </div>
        </div>
        <div
          style={{
            padding: "14px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            flex: 1,
          }}
        >
          {products.map((p, i) => {
            const op = cardReveal(i);
            return (
              <div
                key={p.name}
                style={{
                  background: COLORS.surface,
                  borderRadius: 20,
                  padding: 14,
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  opacity: op,
                  transform: `translateY(${(1 - op) * 20}px)`,
                  border: `1px solid ${p.c}30`,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 72,
                    borderRadius: 12,
                    background: `linear-gradient(160deg, ${p.c}, ${p.c}aa)`,
                    boxShadow: `0 0 20px ${p.c}60`,
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 6,
                      right: 6,
                      height: 4,
                      background: "rgba(0,0,0,0.3)",
                      borderRadius: 2,
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <div style={{ color: COLORS.text, fontSize: 15, fontWeight: 700 }}>
                      {p.name}
                    </div>
                    <div style={{ color: p.c, fontSize: 15, fontWeight: 800 }}>
                      {p.price}
                    </div>
                  </div>
                  <div style={{ color: COLORS.textDim, fontSize: 11 }}>
                    {p.purpose}
                  </div>
                  <div
                    style={{
                      color: COLORS.text,
                      fontSize: 11,
                      marginTop: 4,
                      opacity: 0.8,
                    }}
                  >
                    ◇ {p.why}
                  </div>
                  {p.alt && (
                    <div
                      style={{
                        color: COLORS.good,
                        fontSize: 11,
                        marginTop: 2,
                      }}
                    >
                      ✓ {p.alt}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div
            style={{
              padding: "10px 14px",
              background: `linear-gradient(90deg, ${COLORS.good}30, transparent)`,
              borderRadius: 14,
              color: COLORS.good,
              fontSize: 12,
              fontWeight: 600,
              opacity: interpolate(frame, [180, 210], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            you save $22 by using items you own
          </div>
        </div>
      </PhoneCenter>
      <SceneTitle text="Smart shopping" subtitle="within your budget" />
    </AbsoluteFill>
  );
};

// ============ Final Reveal ============
const SceneFinal: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(0, durationInFrames, 18);

  const rotateY = interpolate(frame, [0, durationInFrames], [-25, 25]);
  const glow = 1 + Math.sin(frame / 16) * 0.3;
  const phoneScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.9 },
  });

  const tagOp = interpolate(frame, [80, 120], [0, 1], {
    extrapolateRight: "clamp",
  });
  const tagY = interpolate(frame, [80, 120], [24, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity }}>
      <Backdrop tone="violet" />
      <Particles count={60} seed="sf" />
      <PhoneCenter rotateY={rotateY} scale={phoneScale} glow={glow}>
        <StatusBar />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flexDirection: "column",
            gap: 22,
          }}
        >
          <div
            style={{
              width: 160,
              height: 160,
              borderRadius: 44,
              background: `linear-gradient(135deg, ${COLORS.neonPink}, ${COLORS.neonViolet})`,
              boxShadow: `0 0 ${60 * glow}px ${COLORS.neonPink}`,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              fontSize: 86,
              color: COLORS.text,
            }}
          >
            ✦
          </div>
          <div
            style={{
              color: COLORS.text,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 2,
            }}
          >
            aria
          </div>
          <div
            style={{
              color: COLORS.textDim,
              fontSize: 13,
              letterSpacing: 4,
            }}
          >
            BEAUTY · HEALTH
          </div>
        </div>
      </PhoneCenter>
      <div
        style={{
          position: "absolute",
          bottom: 90,
          left: 0,
          right: 0,
          textAlign: "center",
          color: COLORS.text,
          fontFamily: FONT,
          fontSize: 38,
          fontWeight: 300,
          letterSpacing: 2,
          opacity: tagOp,
          transform: `translateY(${tagY}px)`,
          textShadow: `0 0 28px ${COLORS.neonPink}80`,
          lineHeight: 1.3,
        }}
      >
        Your skin. Your products.
        <br />
        <span style={{ color: COLORS.neonPink }}>
          Your personal beauty coach.
        </span>
      </div>
    </AbsoluteFill>
  );
};

const SceneTitle: React.FC<{ text: string; subtitle: string }> = ({
  text,
  subtitle,
}) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(frame, [0, 24], [-30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 80,
        left: 100,
        opacity: op,
        transform: `translateX(${x}px)`,
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          fontSize: 18,
          color: COLORS.neonCyan,
          letterSpacing: 6,
          textTransform: "uppercase",
          textShadow: `0 0 12px ${COLORS.neonCyan}80`,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          fontSize: 64,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: -1,
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ============ Master composition ============
export const AriaIntro: React.FC = () => {
  const s1 = 200;
  const s2 = 290;
  const s3 = 290;
  const s4 = 290;
  const s5 = 230;
  const s6 = 250;
  const sf = 220;

  return (
    <AbsoluteFill style={{ background: COLORS.bgA, fontFamily: FONT }}>
      <Sequence durationInFrames={s1}>
        <Scene1Opening durationInFrames={s1} />
      </Sequence>
      <Sequence from={s1} durationInFrames={s2}>
        <Scene2Scanner durationInFrames={s2} />
      </Sequence>
      <Sequence from={s1 + s2} durationInFrames={s3}>
        <Scene3FaceScan durationInFrames={s3} />
      </Sequence>
      <Sequence from={s1 + s2 + s3} durationInFrames={s4}>
        <Scene4Chat durationInFrames={s4} />
      </Sequence>
      <Sequence from={s1 + s2 + s3 + s4} durationInFrames={s5}>
        <Scene5Routine durationInFrames={s5} />
      </Sequence>
      <Sequence from={s1 + s2 + s3 + s4 + s5} durationInFrames={s6}>
        <Scene6Budget durationInFrames={s6} />
      </Sequence>
      <Sequence
        from={s1 + s2 + s3 + s4 + s5 + s6}
        durationInFrames={sf}
      >
        <SceneFinal durationInFrames={sf} />
      </Sequence>
    </AbsoluteFill>
  );
};
