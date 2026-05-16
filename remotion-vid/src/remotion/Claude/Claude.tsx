import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const Claude: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.6 },
  });

  const titleOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subY = interpolate(frame, [25, 45], [20, 0], {
    extrapolateRight: "clamp",
  });

  const outOpacity = interpolate(
    frame,
    [durationInFrames - 20, durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const bgShift = interpolate(frame, [0, durationInFrames], [0, 30]);

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + bgShift}deg, #1a0f0a 0%, #3d1f12 50%, #c96442 100%)`,
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        opacity: outOpacity,
      }}
    >
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          gap: 24,
        }}
      >
        <div
          style={{
            fontSize: 180,
            fontWeight: 700,
            color: "#f5f1eb",
            letterSpacing: -6,
            transform: `scale(${titleScale})`,
            opacity: titleOpacity,
          }}
        >
          Claude
        </div>
        <div
          style={{
            fontSize: 42,
            fontWeight: 400,
            color: "#e8dccb",
            opacity: subOpacity,
            transform: `translateY(${subY}px)`,
            letterSpacing: 1,
          }}
        >
          made with Remotion
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
