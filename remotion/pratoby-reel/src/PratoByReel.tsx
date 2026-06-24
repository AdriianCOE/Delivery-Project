import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const VIDEO = {
  fps: 30,
  durationInFrames: 450,
  width: 1080,
  height: 1920,
} as const;

const TIMELINE = {
  hook: { start: 0, end: 78 },
  storefront: { start: 78, end: 168 },
  product: { start: 168, end: 258 },
  order: { start: 258, end: 348 },
  cta: { start: 348, end: 450 },
} as const;

type SceneKey = keyof typeof TIMELINE;

type IconName =
  | "cart"
  | "check"
  | "link"
  | "order"
  | "panel"
  | "search"
  | "store"
  | "clock"
  | "spark"
  | "whatsapp"
  | "arrowUp"
  | "phone"
  | "money"
  | "user";

const colors = {
  orange: "#f97316",
  orangeDark: "#ea580c",
  orangeDeep: "#c2410c",
  orangeSoft: "#ffedd5",
  orangePale: "#fff7ed",
  cream: "#fffaf4",
  paper: "#fffdf9",
  white: "#ffffff",
  slate: "#0f172a",
  slate2: "#1e293b",
  slateMuted: "#64748b",
  slateSoft: "#94a3b8",
  border: "rgba(249,115,22,0.16)",
  green: "#16a34a",
  greenSoft: "#dcfce7",
} as const;

const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const assets = {
  brandMark: "pratoby-mark-96.png",
  storeTop: "assets/pratoby-reel/store-top.png",
  productListDock: "assets/pratoby-reel/product-list-dock.png",
  productModal: "assets/pratoby-reel/product-modal.png",
  marketingCard: "assets/pratoby-reel/marketing-card.png",
} as const;

// Opcional: coloque uma trilha leve em public/audio/pratoby-reel.mp3 e troque para esse caminho.
const optionalAudioTrack: string | null = null;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const sceneLength = (scene: SceneKey) => TIMELINE[scene].end - TIMELINE[scene].start;

const localFrame = (frame: number, scene: SceneKey) =>
  Math.max(0, frame - TIMELINE[scene].start);

const sceneOpacity = (frame: number, scene: SceneKey, freezeAtEnd = false) => {
  const { start, end } = TIMELINE[scene];
  const fadeIn = interpolate(frame, [start, start + 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (freezeAtEnd) return fadeIn;

  const fadeOut = interpolate(frame, [end - 14, end], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return Math.min(fadeIn, fadeOut);
};

const delayedSpring = (
  frame: number,
  delay: number,
  fps: number,
  damping = 22,
  stiffness = 120,
) =>
  spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: { damping, stiffness },
  });

const fadeUpStyle = (
  frame: number,
  delay: number,
  fps: number,
  distance = 22,
) => {
  const progress = delayedSpring(frame, delay, fps, 24, 120);

  return {
    opacity: clamp(progress, 0, 1),
    transform: `translateY(${(1 - progress) * distance}px)`,
  };
};

const safeDelay = (scene: SceneKey, offset: number) => TIMELINE[scene].start + offset;

const Icon = ({ name, size = 26, color = colors.orange }: { name: IconName; size?: number; color?: string }) => {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === "cart" && (
        <>
          <path {...common} d="M4 5h2l2 10h9l2-7H7" />
          <circle {...common} cx="10" cy="20" r="1.5" />
          <circle {...common} cx="17" cy="20" r="1.5" />
        </>
      )}
      {name === "check" && <path {...common} d="M5 13l4 4L19 7" />}
      {name === "link" && (
        <>
          <path {...common} d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" />
          <path {...common} d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" />
        </>
      )}
      {name === "order" && (
        <>
          <path {...common} d="M7 4h10v16H7z" />
          <path {...common} d="M10 8h4" />
          <path {...common} d="M10 12h5" />
          <path {...common} d="M10 16h3" />
        </>
      )}
      {name === "panel" && (
        <>
          <path {...common} d="M4 5h16v14H4z" />
          <path {...common} d="M8 9h8" />
          <path {...common} d="M8 13h4" />
          <path {...common} d="M15 13h1" />
        </>
      )}
      {name === "search" && (
        <>
          <circle {...common} cx="11" cy="11" r="6" />
          <path {...common} d="m16 16 4 4" />
        </>
      )}
      {name === "store" && (
        <>
          <path {...common} d="M4 10h16l-1.2-5H5.2L4 10Z" />
          <path {...common} d="M6 10v9h12v-9" />
          <path {...common} d="M9 19v-5h6v5" />
        </>
      )}
      {name === "clock" && (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 8v5l3 2" />
        </>
      )}
      {name === "spark" && (
        <>
          <path {...common} d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path {...common} d="M18 15l.9 2.4L21 18l-2.1.6L18 21l-.9-2.4L15 18l2.1-.6L18 15Z" />
        </>
      )}
      {name === "whatsapp" && (
        <>
          <path {...common} d="M5 19l1-3a7 7 0 1 1 2.8 2.5L5 19Z" />
          <path {...common} d="M9.5 9.5c.7 2.1 2 3.4 4 4" />
        </>
      )}
      {name === "arrowUp" && (
        <>
          <path {...common} d="M12 19V5" />
          <path {...common} d="M6 11l6-6 6 6" />
        </>
      )}
      {name === "phone" && (
        <>
          <rect {...common} x="7" y="3" width="10" height="18" rx="2" />
          <path {...common} d="M11 18h2" />
        </>
      )}
      {name === "money" && (
        <>
          <path {...common} d="M4 7h16v10H4z" />
          <circle {...common} cx="12" cy="12" r="2.5" />
          <path {...common} d="M7 10v4M17 10v4" />
        </>
      )}
      {name === "user" && (
        <>
          <circle {...common} cx="12" cy="8" r="3" />
          <path {...common} d="M5 20a7 7 0 0 1 14 0" />
        </>
      )}
    </svg>
  );
};

const Background = ({ scene }: { scene: SceneKey }) => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, scene);
  const softShift = interpolate(Math.sin(frame / 58), [-1, 1], [-34, 34]);
  const rotate = interpolate(local, [0, sceneLength(scene)], [-2.5, 2.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: `
          radial-gradient(circle at ${82 + softShift / 18}% 7%, rgba(249,115,22,0.17), transparent 32%),
          radial-gradient(circle at 12% 92%, rgba(251,146,60,0.10), transparent 38%),
          linear-gradient(160deg, ${colors.cream} 0%, ${colors.white} 58%, ${colors.orangePale} 100%)
        `,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 56,
          borderRadius: 58,
          border: "1px solid rgba(249,115,22,0.10)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 580,
          height: 580,
          right: -250,
          top: -215,
          borderRadius: 190,
          background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(255,237,213,0.06))",
          filter: "blur(10px)",
          transform: `rotate(${rotate}deg)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          left: -260,
          bottom: -245,
          borderRadius: 190,
          background: "linear-gradient(135deg, rgba(234,88,12,0.09), rgba(255,250,244,0))",
          filter: "blur(10px)",
          transform: `rotate(${-rotate}deg)`,
        }}
      />
    </AbsoluteFill>
  );
};

const SceneContainer = ({
  scene,
  freezeAtEnd = false,
  children,
}: {
  scene: SceneKey;
  freezeAtEnd?: boolean;
  children: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, scene);
  const opacity = sceneOpacity(frame, scene, freezeAtEnd);
  const y = interpolate(local, [0, 16], [16, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        overflow: "hidden",
        color: colors.slate,
        fontFamily,
      }}
    >
      <Background scene={scene} />
      <div style={{ position: "relative", width: "100%", height: "100%" }}>{children}</div>
    </AbsoluteFill>
  );
};

const Brand = ({ large = false, center = false }: { large?: boolean; center?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, 0, fps, 22, 120);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: center ? "center" : "flex-start",
        gap: large ? 18 : 12,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 8}px) scale(${0.97 + enter * 0.03})`,
      }}
    >
      <div
        style={{
          width: large ? 116 : 56,
          height: large ? 116 : 56,
          borderRadius: large ? 34 : 17,
          background: colors.white,
          display: "grid",
          placeItems: "center",
          boxShadow: "0 14px 34px rgba(234,88,12,0.16)",
          overflow: "hidden",
          border: "1px solid rgba(249,115,22,0.12)",
        }}
      >
        <Img src={staticFile(assets.brandMark)} style={{ width: "76%", height: "76%", objectFit: "contain" }} />
      </div>
      <div
        style={{
          fontSize: large ? 76 : 34,
          fontWeight: 900,
          letterSpacing: large ? -2 : -0.7,
          color: large ? colors.orangeDark : colors.slate,
          lineHeight: 1,
        }}
      >
        PratoBy
      </div>
    </div>
  );
};

const Eyebrow = ({ children, delay = 0, icon = "spark" }: { children: React.ReactNode; delay?: number; icon?: IconName }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 11,
        padding: "12px 19px",
        borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
        color: colors.white,
        boxShadow: "0 14px 32px rgba(234,88,12,0.20)",
        fontSize: 21,
        fontWeight: 850,
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 12}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <Icon name={icon} size={22} color={colors.white} />
      {children}
    </div>
  );
};

const Headline = ({
  children,
  delay = 0,
  maxWidth = 860,
  size = 70,
  align = "left",
}: {
  children: React.ReactNode;
  delay?: number;
  maxWidth?: number;
  size?: number;
  align?: "left" | "center";
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <h1
      style={{
        ...fadeUpStyle(frame, delay, fps, 22),
        margin: 0,
        maxWidth,
        fontSize: size,
        lineHeight: 0.98,
        letterSpacing: -3,
        color: colors.slate,
        fontWeight: 930,
        textAlign: align,
      }}
    >
      {children}
    </h1>
  );
};

const Subhead = ({
  children,
  delay = 0,
  maxWidth = 720,
  align = "left",
}: {
  children: React.ReactNode;
  delay?: number;
  maxWidth?: number;
  align?: "left" | "center";
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <p
      style={{
        ...fadeUpStyle(frame, delay, fps, 14),
        margin: "20px 0 0",
        maxWidth,
        fontSize: 28,
        lineHeight: 1.28,
        color: colors.slateMuted,
        fontWeight: 650,
        textAlign: align,
      }}
    >
      {children}
    </p>
  );
};

const ScreenshotFrame = ({
  src,
  objectPosition = "top center",
  scale = 1,
  panY = 0,
}: {
  src: string;
  objectPosition?: string;
  scale?: number;
  panY?: number;
}) => (
  <div
    style={{
      position: "absolute",
      inset: 18,
      borderRadius: 48,
      overflow: "hidden",
      background: colors.white,
      boxShadow: "inset 0 0 0 1px rgba(15,23,42,0.05)",
    }}
  >
    <Img
      src={staticFile(src)}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition,
        transform: `scale(${scale}) translateY(${panY}px)`,
      }}
    />
  </div>
);

const PhoneMockup = ({
  src,
  delay = 0,
  width = 540,
  height = 1188,
  objectPosition = "top center",
  scale = 1,
  panY = 0,
  rotate = 0,
}: {
  src: string;
  delay?: number;
  width?: number;
  height?: number;
  objectPosition?: string;
  scale?: number;
  panY?: number;
  rotate?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 120);
  const float = interpolate(Math.sin(frame / 28), [-1, 1], [-4, 4]);
  const sheen = interpolate(frame % 150, [44, 96], [-150, 220], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 70,
        background: "linear-gradient(180deg, #111827, #020617)",
        border: "1px solid rgba(255,255,255,0.12)",
        boxShadow: "0 42px 110px rgba(15,23,42,0.24), 0 16px 34px rgba(234,88,12,0.12)",
        position: "relative",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 56 + float}px) scale(${0.94 + enter * 0.06}) rotate(${rotate}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 24,
          left: "50%",
          width: 136,
          height: 30,
          transform: "translateX(-50%)",
          borderRadius: 999,
          background: "#020617",
          zIndex: 7,
          opacity: 0.85,
        }}
      />
      <ScreenshotFrame src={src} objectPosition={objectPosition} scale={scale} panY={panY} />
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: 48,
          background:
            "linear-gradient(110deg, transparent 36%, rgba(255,255,255,0.03) 43%, rgba(255,255,255,0.14) 50%, rgba(255,255,255,0.03) 57%, transparent 64%)",
          transform: `translateX(${sheen}px)`,
          zIndex: 6,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 18,
          borderRadius: 48,
          border: "1px solid rgba(255,255,255,0.20)",
          zIndex: 7,
          pointerEvents: "none",
        }}
      />
    </div>
  );
};

const FeaturePill = ({
  icon,
  children,
  delay = 0,
  variant = "light",
}: {
  icon: IconName;
  children: React.ReactNode;
  delay?: number;
  variant?: "light" | "orange" | "green";
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);
  const orange = variant === "orange";
  const green = variant === "green";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "13px 18px",
        borderRadius: 999,
        background: orange
          ? `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`
          : green
            ? "rgba(220,252,231,0.96)"
            : "rgba(255,255,255,0.96)",
        border: orange
          ? "1px solid rgba(255,255,255,0.24)"
          : green
            ? "1px solid rgba(34,197,94,0.18)"
            : "1px solid rgba(249,115,22,0.14)",
        boxShadow: orange ? "0 16px 32px rgba(234,88,12,0.18)" : "0 12px 26px rgba(15,23,42,0.06)",
        color: orange ? colors.white : green ? colors.green : colors.slate,
        fontSize: 20,
        fontWeight: 850,
        whiteSpace: "nowrap",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 12}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <Icon name={icon} size={22} color={orange ? colors.white : green ? colors.green : colors.orange} />
      {children}
    </div>
  );
};

const InfoCard = ({
  icon,
  title,
  text,
  delay = 0,
  accent = false,
}: {
  icon: IconName;
  title: string;
  text: string;
  delay?: number;
  accent?: boolean;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);

  return (
    <div
      style={{
        display: "flex",
        gap: 16,
        padding: "22px 24px",
        borderRadius: 30,
        background: accent ? `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})` : "rgba(255,255,255,0.96)",
        border: accent ? "1px solid rgba(255,255,255,0.26)" : "1px solid rgba(249,115,22,0.12)",
        boxShadow: accent ? "0 20px 46px rgba(234,88,12,0.20)" : "0 18px 42px rgba(15,23,42,0.07)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 18}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 17,
          background: accent ? "rgba(255,255,255,0.18)" : colors.orangeSoft,
          display: "grid",
          placeItems: "center",
          flex: "0 0 auto",
        }}
      >
        <Icon name={icon} size={25} color={accent ? colors.white : colors.orange} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 920, color: accent ? colors.white : colors.slate, lineHeight: 1.08 }}>{title}</div>
        <div style={{ marginTop: 7, fontSize: 19, fontWeight: 650, color: accent ? "rgba(255,255,255,0.82)" : colors.slateMuted, lineHeight: 1.2 }}>{text}</div>
      </div>
    </div>
  );
};

const StepList = ({
  steps,
  delay,
}: {
  steps: Array<{ icon: IconName; title: string; text: string }>;
  delay: number;
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    {steps.map((step, index) => (
      <InfoCard
        key={step.title}
        icon={step.icon}
        title={step.title}
        text={step.text}
        delay={delay + index * 8}
        accent={index === 0}
      />
    ))}
  </div>
);

const MiniOrderCard = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 20, 125);

  return (
    <div
      style={{
        width: 460,
        padding: 28,
        borderRadius: 34,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(34,197,94,0.18)",
        boxShadow: "0 30px 76px rgba(15,23,42,0.14)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 22}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ width: 58, height: 58, borderRadius: 20, background: colors.greenSoft, display: "grid", placeItems: "center" }}>
          <Icon name="check" size={27} color={colors.green} />
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 930, color: colors.slate, lineHeight: 1 }}>Novo pedido recebido</div>
          <div style={{ marginTop: 7, fontSize: 18, fontWeight: 700, color: colors.slateMuted }}>Pedido #1042 · Doce Capivara</div>
        </div>
      </div>

      <div style={{ marginTop: 23, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ padding: "15px 16px", borderRadius: 22, background: "#f8fafc" }}>
          <div style={{ fontSize: 14, fontWeight: 850, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 930, color: colors.slate }}>R$ 33,60</div>
        </div>
        <div style={{ padding: "15px 16px", borderRadius: 22, background: colors.greenSoft }}>
          <div style={{ fontSize: 14, fontWeight: 850, color: "rgba(22,163,74,0.72)", textTransform: "uppercase", letterSpacing: 0.5 }}>Chegou</div>
          <div style={{ marginTop: 6, fontSize: 26, fontWeight: 930, color: colors.green }}>Agora</div>
        </div>
      </div>

      <div style={{ marginTop: 16, padding: "17px 19px", borderRadius: 22, background: colors.orangePale, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 19, fontWeight: 850, color: colors.slate }}>Status</span>
        <span style={{ fontSize: 19, fontWeight: 930, color: colors.orangeDark }}>Aguardando confirmação</span>
      </div>
    </div>
  );
};

const CTAButton = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);
  const glow = interpolate(Math.sin(frame / 24), [-1, 1], [0.18, 0.28]);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: "22px 44px",
        borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
        color: colors.white,
        boxShadow: `0 22px 48px rgba(234,88,12,${glow})`,
        fontSize: 31,
        fontWeight: 920,
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 16}px) scale(${0.95 + enter * 0.05})`,
      }}
    >
      <Icon name="link" size={28} color={colors.white} />
      {children}
    </div>
  );
};

const TopProgress = () => {
  const frame = useCurrentFrame();
  const scenes = Object.keys(TIMELINE) as SceneKey[];

  return (
    <div style={{ position: "absolute", top: 54, left: 82, right: 82, display: "flex", gap: 8, zIndex: 50 }}>
      {scenes.map((scene) => {
        const { start, end } = TIMELINE[scene];
        const fill = clamp((frame - start) / (end - start), 0, 1);

        return (
          <div key={scene} style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(15,23,42,0.10)", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${fill * 100}%`, borderRadius: 999, background: `linear-gradient(90deg, ${colors.orange}, ${colors.orangeDark})` }} />
          </div>
        );
      })}
    </div>
  );
};

const SceneOne = () => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, "hook");
  const phoneY = interpolate(local, [0, 64], [76, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="hook">
      <div style={{ position: "absolute", top: 112, left: 82 }}>
        <Brand />
      </div>

      <div style={{ position: "absolute", top: 262, left: 82, width: 650 }}>
        <Eyebrow delay={5} icon="money">Sem comissão por pedido</Eyebrow>
        <div style={{ marginTop: 44 }}>
          <Headline delay={9} size={72} maxWidth={760}>
            Venda direto pelo seu <span style={{ color: colors.orange }}>próprio link</span>.
          </Headline>
          <Subhead delay={15} maxWidth={620}>
            Cardápio digital, carrinho e pedidos online para sua loja vender com mais controle.
          </Subhead>
        </div>
      </div>

      <div style={{ position: "absolute", left: 78, top: 850, width: 430, display: "flex", flexDirection: "column", gap: 14 }}>
        <InfoCard icon="store" title="Delivery próprio" text="Sua loja recebe pedidos sem depender só de marketplace." delay={30} />
        <InfoCard icon="link" title="Link da loja" text="Compartilhe no Instagram, WhatsApp e bio." delay={38} />
      </div>

      <div style={{ position: "absolute", right: -40, bottom: -220, transform: `translateY(${phoneY}px)` }}>
        <PhoneMockup src={assets.storeTop} delay={18} width={560} height={1240} objectPosition="top center" scale={1.04} rotate={-2} />
      </div>
    </SceneContainer>
  );
};

const SceneTwo = () => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, "storefront");
  const panY = interpolate(local, [20, 84], [0, -105], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="storefront">
      <div style={{ position: "absolute", top: 210, left: 82, right: 82, textAlign: "center" }}>
        <Headline delay={safeDelay("storefront", 5)} size={64} maxWidth={920} align="center">
          Uma loja bonita no celular,
          <br /> pronta para vender.
        </Headline>
        <Subhead delay={safeDelay("storefront", 11)} maxWidth={760} align="center">
          Produtos, categorias, busca e carrinho em uma experiência simples para o cliente.
        </Subhead>
      </div>

      <div style={{ position: "absolute", left: 72, top: 570 }}>
        <PhoneMockup src={assets.productListDock} delay={safeDelay("storefront", 15)} width={510} height={1110} objectPosition="center center" scale={1.15} panY={panY} />
      </div>

      <div style={{ position: "absolute", right: 72, top: 640, width: 390 }}>
        <StepList
          delay={safeDelay("storefront", 24)}
          steps={[
            { icon: "search", title: "Cliente encontra", text: "Busca e categorias deixam o pedido mais rápido." },
            { icon: "cart", title: "Adiciona ao carrinho", text: "O total aparece claro durante a compra." },
            { icon: "phone", title: "Compra no celular", text: "Interface mobile pensada para delivery." },
          ]}
        />
      </div>
    </SceneContainer>
  );
};

const SceneThree = () => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, "product");
  const panY = interpolate(local, [18, 76], [0, -52], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cartPulse = interpolate(Math.sin(local / 7), [-1, 1], [0.99, 1.035]);

  return (
    <SceneContainer scene="product">
      <div style={{ position: "absolute", top: 208, left: 82, width: 610 }}>
        <Headline delay={safeDelay("product", 5)} size={64} maxWidth={650}>
          O cliente monta o pedido em poucos toques.
        </Headline>
        <Subhead delay={safeDelay("product", 11)} maxWidth={600}>
          Opções, tamanhos, subtotal e botão de compra no mesmo fluxo.
        </Subhead>
      </div>

      <div style={{ position: "absolute", left: 70, top: 610, width: 420, display: "flex", flexDirection: "column", gap: 14 }}>
        <InfoCard icon="order" title="Produtos com opções" text="Tamanhos, adicionais e observações organizados." delay={safeDelay("product", 28)} accent />
        <InfoCard icon="money" title="Subtotal claro" text="O cliente sabe o valor antes de finalizar." delay={safeDelay("product", 38)} />
        <InfoCard icon="cart" title="Carrinho pronto" text="Pedido segue para o fluxo de checkout." delay={safeDelay("product", 48)} />
      </div>

      <div style={{ position: "absolute", right: 40, bottom: -120, transform: `scale(${cartPulse})` }}>
        <PhoneMockup src={assets.productModal} delay={safeDelay("product", 16)} width={560} height={1240} objectPosition="center center" scale={1.02} panY={panY} rotate={2} />
      </div>
    </SceneContainer>
  );
};

const SceneFour = () => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, "order");
  const panY = interpolate(local, [20, 70], [-62, -120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="order">
      <div style={{ position: "absolute", top: 210, left: 82, width: 840 }}>
        <Headline delay={safeDelay("order", 5)} size={64} maxWidth={850}>
          Pedido direto para a loja.
          <br /> Menos bagunça no WhatsApp.
        </Headline>
        <Subhead delay={safeDelay("order", 11)} maxWidth={740}>
          O cliente compra pelo link e o lojista acompanha tudo no painel.
        </Subhead>
      </div>

      <div style={{ position: "absolute", left: -70, bottom: -160 }}>
        <PhoneMockup src={assets.productListDock} delay={safeDelay("order", 18)} width={520} height={1160} objectPosition="bottom center" scale={1.14} panY={panY} rotate={2} />
      </div>

      <div style={{ position: "absolute", right: 72, top: 680 }}>
        <MiniOrderCard delay={safeDelay("order", 28)} />
      </div>

      <div style={{ position: "absolute", right: 72, top: 1110, width: 460, display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
        <InfoCard icon="panel" title="Painel do lojista" text="Status do pedido, atendimento e operação no mesmo lugar." delay={safeDelay("order", 48)} />
        <InfoCard icon="whatsapp" title="WhatsApp como apoio" text="O pedido não fica perdido em conversas soltas." delay={safeDelay("order", 58)} />
      </div>
    </SceneContainer>
  );
};

const SceneFive = () => {
  const frame = useCurrentFrame();
  const local = localFrame(frame, "cta");
  const previewOpacity = interpolate(local, [48, 62], [0, 0.16], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const hintOpacity = interpolate(Math.sin(local / 13), [-1, 1], [0.5, 1]);

  return (
    <SceneContainer scene="cta" freezeAtEnd>
      <div style={{ position: "absolute", top: 186, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Brand large center />
      </div>
      <div style={{ position: "absolute", top: 420, left: 90, right: 90, textAlign: "center" }}>
        <Headline align="center" maxWidth={900} size={72} delay={safeDelay("cta", 10)}>
          Seu cardápio.
          <br /> Seu delivery.
          <br /> Sua <span style={{ color: colors.orange }}>margem</span>.
        </Headline>
        <Subhead align="center" maxWidth={810} delay={safeDelay("cta", 17)}>
          Venda online pelo seu próprio link, sem comissão por pedido.
        </Subhead>
      </div>
      <div style={{ position: "absolute", top: 842, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <CTAButton delay={safeDelay("cta", 28)}>Conheça o PratoBy</CTAButton>
      </div>
      <div style={{ position: "absolute", top: 1002, left: 126, right: 126, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <FeaturePill icon="check" delay={safeDelay("cta", 38)}>Sem comissão</FeaturePill>
        <FeaturePill icon="cart" delay={safeDelay("cta", 44)}>Pedidos online</FeaturePill>
        <FeaturePill icon="panel" delay={safeDelay("cta", 50)}>Painel do lojista</FeaturePill>
        <FeaturePill icon="link" delay={safeDelay("cta", 56)}>Link próprio</FeaturePill>
      </div>
      <div
        style={{
          position: "absolute",
          left: 155,
          right: 155,
          top: 1204,
          height: 250,
          borderRadius: 42,
          overflow: "hidden",
          opacity: previewOpacity,
          boxShadow: "0 22px 60px rgba(15,23,42,0.12)",
          border: "1px solid rgba(249,115,22,0.12)",
        }}
      >

      </div>
      <div
        style={{
          position: "absolute",
          bottom: 248,
          left: 0,
          right: 0,
          textAlign: "center",
          opacity: interpolate(local, [62, 76], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 930, color: colors.orangeDark, letterSpacing: -0.4 }}>pratoby.com</div>
        <div style={{ marginTop: 18, display: "flex", justifyContent: "center", alignItems: "center", gap: 8, opacity: hintOpacity, color: colors.slateMuted, fontSize: 20, fontWeight: 820 }}>
          <Icon name="arrowUp" size={20} color={colors.slateMuted} />
          Comece pelo seu próprio link
        </div>
      </div>
    </SceneContainer>
  );
};

const OptionalAudio = () => {
  if (!optionalAudioTrack) return null;

  return (
    <Audio
      src={staticFile(optionalAudioTrack)}
      volume={(frame) =>
        interpolate(frame, [0, 20, VIDEO.durationInFrames - 30, VIDEO.durationInFrames], [0, 0.2, 0.2, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
  );
};

export const PratoByReel = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.warm, fontFamily }}>
      <OptionalAudio />
      <SceneOne />
      <SceneTwo />
      <SceneThree />
      <SceneFour />
      <SceneFive />
      <TopProgress />
    </AbsoluteFill>
  );
};

export const pratoByReelMetadata = VIDEO;
