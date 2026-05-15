import {
  AbsoluteFill,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BG = "#1a0f0a";
const ACCENT = "#c96442";
const ACCENT_SOFT = "#e8a07a";
const TEXT = "#f5f1eb";
const TEXT_DIM = "#b8a89a";
const SURFACE = "#2a1810";
const SURFACE_LIGHT = "#3d2317";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const MONO = "'SF Mono', Menlo, Monaco, Consolas, monospace";

const useFade = (inFrame: number, outFrame: number, hold = 15) => {
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

const SceneShell: React.FC<{
  children: React.ReactNode;
  durationInFrames: number;
}> = ({ children, durationInFrames }) => {
  const opacity = useFade(0, durationInFrames, 12);
  return (
    <AbsoluteFill
      style={{
        background: BG,
        fontFamily: FONT,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

const FeatureLabel: React.FC<{ kicker: string; title: string }> = ({
  kicker,
  title,
}) => {
  const frame = useCurrentFrame();
  const titleY = interpolate(frame, [4, 22], [30, 0], {
    extrapolateRight: "clamp",
  });
  const titleOp = interpolate(frame, [4, 22], [0, 1], {
    extrapolateRight: "clamp",
  });
  const kickerOp = interpolate(frame, [0, 14], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        position: "absolute",
        top: 80,
        left: 100,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 600,
          color: ACCENT_SOFT,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: kickerOp,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          fontSize: 78,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: -2,
          transform: `translateY(${titleY}px)`,
          opacity: titleOp,
        }}
      >
        {title}
      </div>
    </div>
  );
};

const ClaudeMark: React.FC<{ size?: number }> = ({ size = 64 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: ACCENT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: TEXT,
        fontWeight: 800,
        fontSize: size * 0.55,
        fontFamily: FONT,
        boxShadow: `0 ${size * 0.1}px ${size * 0.3}px rgba(201,100,66,0.35)`,
      }}
    >
      C
    </div>
  );
};

const TitleScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(0, durationInFrames, 12);

  const markScale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 110, mass: 0.7 },
  });
  const titleOp = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [10, 28], [20, 0], {
    extrapolateRight: "clamp",
  });
  const subOp = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const bgRot = interpolate(frame, [0, durationInFrames], [120, 160]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${bgRot}deg, ${BG} 0%, #3d1f12 55%, ${ACCENT} 110%)`,
        fontFamily: FONT,
        opacity,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div style={{ transform: `scale(${markScale})` }}>
        <ClaudeMark size={140} />
      </div>
      <div
        style={{
          fontSize: 120,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: -4,
          opacity: titleOp,
          transform: `translateY(${titleY}px)`,
        }}
      >
        Claude Desktop
      </div>
      <div
        style={{
          fontSize: 32,
          color: TEXT_DIM,
          letterSpacing: 2,
          opacity: subOp,
        }}
      >
        your AI collaborator
      </div>
    </AbsoluteFill>
  );
};

const Bubble: React.FC<{
  who: "claude" | "you";
  text: string;
  appearAt: number;
}> = ({ who, text, appearAt }) => {
  const frame = useCurrentFrame();
  const op = interpolate(frame, [appearAt, appearAt + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, [appearAt, appearAt + 14], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const isClaude = who === "claude";
  return (
    <div
      style={{
        alignSelf: isClaude ? "flex-start" : "flex-end",
        background: isClaude ? SURFACE_LIGHT : ACCENT,
        color: TEXT,
        padding: "20px 28px",
        borderRadius: 22,
        borderTopLeftRadius: isClaude ? 6 : 22,
        borderTopRightRadius: isClaude ? 22 : 6,
        fontSize: 28,
        maxWidth: 720,
        opacity: op,
        transform: `translateY(${y}px)`,
        lineHeight: 1.35,
      }}
    >
      {text}
    </div>
  );
};

const CoworkScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <FeatureLabel kicker="feature 01" title="Cowork" />
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 100,
          right: 100,
          bottom: 80,
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: 36,
          background: SURFACE,
          borderRadius: 24,
          border: `1px solid ${SURFACE_LIGHT}`,
        }}
      >
        <Bubble
          who="you"
          text="Help me draft the launch announcement."
          appearAt={20}
        />
        <Bubble
          who="claude"
          text="Sure — want it punchy or detailed? I can riff on a few angles."
          appearAt={55}
        />
        <Bubble
          who="you"
          text="Punchy. Three options."
          appearAt={100}
        />
        <Bubble
          who="claude"
          text="On it. Pulling the product brief and your last three posts for tone…"
          appearAt={140}
        />
      </div>
    </SceneShell>
  );
};

const codeLines: { t: string; color: string }[] = [
  { t: "// refactor with Claude", color: TEXT_DIM },
  { t: "export async function summarize(", color: TEXT },
  { t: "  notes: Note[],", color: TEXT },
  { t: ") {", color: TEXT },
  { t: "  const grouped = groupByTopic(notes);", color: TEXT },
  { t: "  return Promise.all(", color: TEXT },
  { t: "    grouped.map((g) => claude.summarize(g)),", color: ACCENT_SOFT },
  { t: "  );", color: TEXT },
  { t: "}", color: TEXT },
];

const CodeScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <FeatureLabel kicker="feature 02" title="Code" />
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 100,
          right: 100,
          bottom: 80,
          background: SURFACE,
          borderRadius: 24,
          border: `1px solid ${SURFACE_LIGHT}`,
          padding: 36,
          fontFamily: MONO,
          fontSize: 30,
          lineHeight: 1.5,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: c,
              }}
            />
          ))}
          <div
            style={{
              marginLeft: 16,
              color: TEXT_DIM,
              fontSize: 20,
              fontFamily: FONT,
            }}
          >
            summarize.ts
          </div>
        </div>
        {codeLines.map((line, i) => {
          const appearAt = 18 + i * 10;
          const op = interpolate(
            frame,
            [appearAt, appearAt + 8],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
          );
          return (
            <div
              key={i}
              style={{
                color: line.color,
                opacity: op,
                whiteSpace: "pre",
              }}
            >
              {line.t}
            </div>
          );
        })}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: FONT,
            fontSize: 22,
            color: TEXT_DIM,
            opacity: interpolate(frame, [140, 160], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          <ClaudeMark size={36} />
          <span>
            <span style={{ color: ACCENT_SOFT }}>claude</span> wrote 14 lines · 2
            tests passing
          </span>
        </div>
      </div>
    </SceneShell>
  );
};

const ComputerUseScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const cursorX = interpolate(frame, [0, durationInFrames], [120, 1100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorY = interpolate(
    frame,
    [0, 40, 80, 130, durationInFrames],
    [120, 280, 200, 380, 320],
  );
  const clickPulse = interpolate(
    frame % 60,
    [0, 12, 24],
    [0, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <SceneShell durationInFrames={durationInFrames}>
      <FeatureLabel kicker="feature 03" title="Computer Use" />
      <div
        style={{
          position: "absolute",
          top: 280,
          left: 100,
          right: 100,
          bottom: 80,
          background: SURFACE,
          borderRadius: 24,
          border: `1px solid ${SURFACE_LIGHT}`,
          padding: 0,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: 44,
            background: "#1f1209",
            display: "flex",
            alignItems: "center",
            paddingLeft: 18,
            gap: 8,
            borderBottom: `1px solid ${SURFACE_LIGHT}`,
          }}
        >
          {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
            <div
              key={c}
              style={{
                width: 12,
                height: 12,
                borderRadius: 6,
                background: c,
              }}
            />
          ))}
          <div
            style={{
              marginLeft: 24,
              fontSize: 18,
              color: TEXT_DIM,
              fontFamily: FONT,
            }}
          >
            calendar · invoices · email
          </div>
        </div>
        <div
          style={{
            position: "relative",
            padding: 32,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 24,
            height: "calc(100% - 44px)",
          }}
        >
          {[
            { title: "Inbox", lines: ["Re: Q2 plan", "Invoice #1042", "Standup notes"] },
            { title: "Calendar", lines: ["10:00 design sync", "13:00 1:1", "15:30 review"] },
            { title: "Tasks", lines: ["Send follow-ups", "Approve invoices", "Draft memo"] },
          ].map((card, i) => {
            const appearAt = 10 + i * 18;
            const op = interpolate(
              frame,
              [appearAt, appearAt + 14],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            const y = interpolate(
              frame,
              [appearAt, appearAt + 14],
              [20, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            );
            return (
              <div
                key={card.title}
                style={{
                  background: SURFACE_LIGHT,
                  borderRadius: 16,
                  padding: 22,
                  opacity: op,
                  transform: `translateY(${y}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 22,
                    color: ACCENT_SOFT,
                    fontWeight: 600,
                  }}
                >
                  {card.title}
                </div>
                {card.lines.map((l) => (
                  <div
                    key={l}
                    style={{ fontSize: 20, color: TEXT, opacity: 0.85 }}
                  >
                    {l}
                  </div>
                ))}
              </div>
            );
          })}
          <div
            style={{
              position: "absolute",
              left: cursorX,
              top: cursorY,
              width: 32,
              height: 32,
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: -10,
                borderRadius: 999,
                background: ACCENT,
                opacity: clickPulse * 0.4,
                transform: `scale(${1 + clickPulse * 1.4})`,
              }}
            />
            <svg width="32" height="32" viewBox="0 0 24 24">
              <path
                d="M3 2 L3 18 L8 14 L11 21 L14 20 L11 13 L18 13 Z"
                fill={TEXT}
                stroke={BG}
                strokeWidth="1.2"
              />
            </svg>
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const OutroScene: React.FC<{ durationInFrames: number }> = ({
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = useFade(0, durationInFrames, 12);
  const markScale = spring({
    frame,
    fps,
    config: { damping: 13, stiffness: 100, mass: 0.7 },
  });
  const titleOp = interpolate(frame, [10, 28], [0, 1], {
    extrapolateRight: "clamp",
  });
  const ctaOp = interpolate(frame, [30, 50], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 60%, #3d1f12 0%, ${BG} 70%)`,
        fontFamily: FONT,
        opacity,
        justifyContent: "center",
        alignItems: "center",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <div style={{ transform: `scale(${markScale})` }}>
        <ClaudeMark size={120} />
      </div>
      <div
        style={{
          fontSize: 84,
          fontWeight: 700,
          color: TEXT,
          letterSpacing: -3,
          opacity: titleOp,
        }}
      >
        Claude Desktop
      </div>
      <div
        style={{
          fontSize: 28,
          color: ACCENT_SOFT,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: ctaOp,
        }}
      >
        download · claude.ai/download
      </div>
    </AbsoluteFill>
  );
};

export const ClaudeIntro: React.FC = () => {
  const titleDur = 90;
  const coworkDur = 210;
  const codeDur = 210;
  const computerDur = 210;
  const outroDur = 180;

  return (
    <AbsoluteFill style={{ background: BG }}>
      <Sequence durationInFrames={titleDur}>
        <TitleScene durationInFrames={titleDur} />
      </Sequence>
      <Sequence from={titleDur} durationInFrames={coworkDur}>
        <CoworkScene durationInFrames={coworkDur} />
      </Sequence>
      <Sequence from={titleDur + coworkDur} durationInFrames={codeDur}>
        <CodeScene durationInFrames={codeDur} />
      </Sequence>
      <Sequence
        from={titleDur + coworkDur + codeDur}
        durationInFrames={computerDur}
      >
        <ComputerUseScene durationInFrames={computerDur} />
      </Sequence>
      <Sequence
        from={titleDur + coworkDur + codeDur + computerDur}
        durationInFrames={outroDur}
      >
        <OutroScene durationInFrames={outroDur} />
      </Sequence>
    </AbsoluteFill>
  );
};
