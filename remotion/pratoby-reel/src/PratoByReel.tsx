import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/**
 * PratoBy — Reel institucional
 * ---------------------------------------------------------------------------
 * 1080×1920 @ 30fps · 600 frames (20s). Ver `VIDEO` / `pratoByReelMetadata`
 * para registrar a <Composition> em Root.tsx:
 *
 *   <Composition
 *     id="PratoByReel"
 *     component={PratoByReel}
 *     fps={pratoByReelMetadata.fps}
 *     width={pratoByReelMetadata.width}
 *     height={pratoByReelMetadata.height}
 *     durationInFrames={pratoByReelMetadata.durationInFrames}
 *   />
 *
 * Assets esperados em /public:
 *   - pratoby-mark-96.png
 *   - assets/pratoby-reel/store-top.png
 *   - assets/pratoby-reel/product-list-dock.png
 *   - assets/pratoby-reel/product-modal.png
 *   - assets/pratoby-reel/marketing-card.png
 *   - audio/pratoby-bed.wav      (trilha de fundo, 20s)
 *   - audio/sfx-whoosh*.wav      (entradas/transições com variações)
 *   - audio/sfx-pop.wav          (confirmação de UI)
 *   - audio/sfx-cash.wav        (moeda — "sem comissão")
 *   - audio/sfx-ding.wav         (notificação — novo pedido)
 *   - audio/sfx-chime.wav        (stinger de encerramento da marca)
 *   - audio/sfx-cut.wav          (tick seco — início de cada cena)
 *
 * Som: a trilha (BackgroundBed) toca do frame 0 ao final em loop, com fade-in/out.
 * Cada efeito (SoundEffect) é disparado no MESMO "delay" do elemento visual que
 * ele acompanha, então o áudio sempre nasce sincronizado com a animação.
 * CutFlash + sfx-cut tocam automaticamente no frame 0 de TODA cena (dentro de
 * SceneContainer) — é o que dá intenção ao corte seco entre cenas.
 *
 * Arquitetura: cada cena vive dentro de um <Sequence>, então useCurrentFrame()
 * já é LOCAL ao início da cena — os "delay" usados pelos componentes internos
 * são sempre relativos ao início da própria cena, nunca ao frame global.
 *
 * Zona segura (Instagram Reels/Stories/Feed): a UI do app cobre faixas no
 * topo (perfil/menu, ~150px) e na base (legenda, CTA de seguir, ícones de
 * curtir/comentar, ~300px). Todo TEXTO relevante fica fora dessas faixas —
 * SAFE_TOP / SAFE_BOTTOM abaixo. Elementos puramente decorativos (mockups de
 * celular, fundos) podem sangrar até a borda sem problema.
 *
 * Tipografia: o stack abaixo depende de fontes do sistema, que nem sempre
 * existem na máquina de render (Chrome headless). Para fidelidade garantida
 * em qualquer ambiente, troque por @remotion/google-fonts/Inter:
 *   import {loadFont} from "@remotion/google-fonts/Inter";
 *   const {fontFamily} = loadFont("normal", {weights: ["600", "700", "800", "900"]});
 */

const VIDEO = {
  fps: 30,
  durationInFrames: 600,
  width: 1080,
  height: 1920,
} as const;

// Zona segura: nenhum TEXTO deve ficar acima de SAFE_TOP nem abaixo de
// (height - SAFE_BOTTOM_MARGIN).
const SAFE_TOP = 150;
const SAFE_BOTTOM_MARGIN = 300;

const TIMELINE = {
  hook: { start: 0, end: 104, label: "Hook — Sem comissão" },
  storefront: { start: 104, end: 224, label: "Vitrine — Loja no celular" },
  product: { start: 224, end: 344, label: "Produto — Montar pedido" },
  order: { start: 344, end: 464, label: "Pedido — Painel do lojista" },
  cta: { start: 464, end: 600, label: "CTA — Marca" },
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
  | "whatsapp"
  | "arrowUp"
  | "phone"
  | "money";

const colors = {
  orange: "#f97316",
  orangeDark: "#ea580c",
  orangeSoft: "#ffedd5",
  orangePale: "#fff7ed",
  cream: "#fffaf4",
  white: "#ffffff",
  slate: "#0f172a",
  slateMuted: "#64748b",
  slateSoft: "#94a3b8",
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
  audio: {
    bed: "audio/pratoby-bed.wav",
    whoosh: "audio/sfx-whoosh.wav",
    whooshSoft: "audio/sfx-whoosh-soft.wav",
    whooshFast: "audio/sfx-whoosh-fast.wav",
    whooshDeep: "audio/sfx-whoosh-deep.wav",
    pop: "audio/sfx-pop.wav",
    cash: "audio/sfx-cash.wav",
    ding: "audio/sfx-ding.wav",
    chime: "audio/sfx-chime.wav",
    cut: "audio/sfx-cut.wav",
  },
} as const;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const sceneLength = (scene: SceneKey) => TIMELINE[scene].end - TIMELINE[scene].start;

/**
 * Curva de opacidade de uma cena, em frame LOCAL (0 = início da cena).
 * Em vez de cada cena apagar no final, fazemos só um micro fade-in no
 * começo (6 frames) — como as Sequences são coladas uma na outra, a tela
 * nunca fica "quase vazia" numa transição. O corte seco entre cenas ganha
 * intenção própria via <CutFlash />, dentro de SceneContainer.
 */
const sceneOpacity = (localFrame: number) =>
  interpolate(localFrame, [0, 6], [0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
    </svg>
  );
};

const Background = ({ durationInFrames }: { durationInFrames: number }) => {
  const frame = useCurrentFrame();
  const softShift = interpolate(Math.sin(frame / 58), [-1, 1], [-34, 34]);
  const rotate = interpolate(frame, [0, durationInFrames], [-2.5, 2.5], {
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
  children,
}: {
  scene: SceneKey;
  children: React.ReactNode;
}) => {
  const frame = useCurrentFrame();
  const duration = sceneLength(scene);
  const opacity = sceneOpacity(frame);
  const y = interpolate(frame, [0, 16], [16, 0], {
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
      <SoundEffect src={assets.audio.cut} at={0} volume={0.36} />
      <Background durationInFrames={duration} />
      <CutFlash />
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
        gap: large ? 14 : 12,
        opacity: enter,
        transform: `translateX(${large && center ? 10 : 0}px) translateY(${(1 - enter) * 8}px) scale(${0.97 + enter * 0.03})`,
      }}
    >
      <div
        style={{
          width: large ? 96 : 56,
          height: large ? 96 : 56,
          borderRadius: large ? 28 : 17,
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
          fontSize: large ? 66 : 34,
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

const Eyebrow = ({ children, delay = 0, icon }: { children: React.ReactNode; delay?: number; icon: IconName }) => {
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
        fontWeight: 800,
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
        fontWeight: 900,
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
        fontWeight: 600,
        textAlign: align,
      }}
    >
      {children}
    </p>
  );
};

/** Legenda curta sob a marca — reforça o que é o PratoBy nos primeiros segundos. */
const Tagline = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <p
      style={{
        ...fadeUpStyle(frame, delay, fps, 8),
        margin: "10px 0 0",
        fontSize: 20,
        fontWeight: 700,
        color: colors.slateMuted,
        letterSpacing: 0.2,
      }}
    >
      {children}
    </p>
  );
};

/** Linha leve com check — reforço de benefício, mais discreta que o InfoCard. */
const ChecklistItem = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 130);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        opacity: clamp(enter, 0, 1),
        transform: `translateX(${(1 - enter) * -10}px)`,
        fontSize: 21,
        fontWeight: 700,
        color: colors.slate,
      }}
    >
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: colors.greenSoft, display: "grid", placeItems: "center", flex: "0 0 auto" }}>
        <Icon name="check" size={15} color={colors.green} />
      </div>
      {children}
    </div>
  );
};

/** Tag leve, sem ícone — usada para listar categorias de cardápio. */
const TagChip = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 140);

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "10px 18px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.9)",
        border: "1px solid rgba(249,115,22,0.16)",
        color: colors.slateMuted,
        fontSize: 18,
        fontWeight: 700,
        opacity: clamp(enter, 0, 1),
        transform: `scale(${0.92 + enter * 0.08})`,
      }}
    >
      {children}
    </div>
  );
};

/** Etiqueta flutuante de preço — estilo "sticker", preenche vazios perto do celular. */
const PlanTeaser = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 18, 150);
  const floatY = interpolate(Math.sin(frame / 22), [-1, 1], [-3, 3]);

  return (
    <div
      style={{
        width: 300,
        padding: "20px 22px",
        borderRadius: 30,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(249,115,22,0.18)",
        boxShadow:
          "0 22px 52px rgba(15,23,42,0.12), 0 12px 28px rgba(249,115,22,0.10)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 16 + floatY}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 999,
          background: colors.orangePale,
          color: colors.orangeDark,
          fontSize: 13,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        <Icon name="money" size={15} color={colors.orangeDark} />
        Plano Essencial
      </div>

      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "flex-end",
          gap: 6,
        }}
      >
        <span
          style={{
            fontSize: 38,
            fontWeight: 950,
            letterSpacing: -1.3,
            color: colors.slate,
            lineHeight: 1,
          }}
        >
          R$ 59,99
        </span>
        <span
          style={{
            marginBottom: 4,
            fontSize: 15,
            fontWeight: 800,
            color: colors.slateMuted,
          }}
        >
          /mês
        </span>
      </div>

      <div
        style={{
          marginTop: 10,
          paddingTop: 12,
          borderTop: "1px solid rgba(249,115,22,0.12)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 16,
          fontWeight: 850,
          color: colors.orangeDark,
        }}
      >
        <Icon name="check" size={17} color={colors.orangeDark} />
        Sem comissão por pedido
      </div>
    </div>
  );
};

const ScreenshotFrame = ({
  src,
  objectPosition = "top center",
  objectFit = "cover",
  scale = 1,
  panY = 0,
}: {
  src: string;
  objectPosition?: string;
  objectFit?: "cover" | "contain";
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
        objectFit,
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
  objectFit = "cover",
  scale = 1,
  panY = 0,
  rotate = 0,
}: {
  src: string;
  delay?: number;
  width?: number;
  height?: number;
  objectPosition?: string;
  objectFit?: "cover" | "contain";
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
      <ScreenshotFrame
        src={src}
        objectFit={objectFit}
        objectPosition={objectPosition}
        scale={scale}
        panY={panY}
      />
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
  variant?: "light" | "orange";
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);
  const orange = variant === "orange";

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
          : "rgba(255,255,255,0.96)",
        border: orange
          ? "1px solid rgba(255,255,255,0.24)"
          : "1px solid rgba(249,115,22,0.14)",
        boxShadow: orange ? "0 16px 32px rgba(234,88,12,0.18)" : "0 12px 26px rgba(15,23,42,0.06)",
        color: orange ? colors.white : colors.slate,
        fontSize: 20,
        fontWeight: 800,
        whiteSpace: "nowrap",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 12}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <Icon name={icon} size={22} color={orange ? colors.white : colors.orange} />
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
        <div style={{ fontSize: 24, fontWeight: 900, color: accent ? colors.white : colors.slate, lineHeight: 1.08 }}>{title}</div>
        <div style={{ marginTop: 7, fontSize: 19, fontWeight: 600, color: accent ? "rgba(255,255,255,0.82)" : colors.slateMuted, lineHeight: 1.2 }}>{text}</div>
      </div>
    </div>
  );
};

const StatCard = ({
  icon,
  label,
  value,
  text,
  delay = 0,
  tone = "light",
}: {
  icon: IconName;
  label: string;
  value: string;
  text: string;
  delay?: number;
  tone?: "light" | "orange";
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);
  const accent = tone === "orange";

  return (
    <div
      style={{
        padding: "22px 24px",
        borderRadius: 28,
        background: accent
          ? `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`
          : "rgba(255,255,255,0.96)",
        border: accent
          ? "1px solid rgba(255,255,255,0.22)"
          : "1px solid rgba(249,115,22,0.12)",
        boxShadow: accent
          ? "0 18px 42px rgba(234,88,12,0.22)"
          : "0 16px 34px rgba(15,23,42,0.07)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 18}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            background: accent ? "rgba(255,255,255,0.18)" : colors.orangeSoft,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
          }}
        >
          <Icon name={icon} size={19} color={accent ? colors.white : colors.orange} />
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: 0.7,
            textTransform: "uppercase",
            color: accent ? "rgba(255,255,255,0.74)" : colors.slateSoft,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 34,
          fontWeight: 900,
          lineHeight: 1,
          color: accent ? colors.white : colors.slate,
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 18,
          lineHeight: 1.2,
          fontWeight: 700,
          color: accent ? "rgba(255,255,255,0.82)" : colors.slateMuted,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * Pilha de InfoCards/Checklist em UM único container flex (gap controla o
 * espaçamento de verdade, em vez de cada item ter um "top" absoluto chutado
 * — é exatamente isso que causava textos colados/sobrepostos na versão
 * anterior). Aceita qualquer mistura de InfoCard/ChecklistItem como filhos.
 */
const StackColumn = ({
  top,
  left,
  right,
  width,
  gap = 14,
  children,
}: {
  top: number;
  left?: number;
  right?: number;
  width?: number;
  gap?: number;
  children: React.ReactNode;
}) => (
  <div
    style={{
      position: "absolute",
      top,
      left,
      right,
      width,
      display: "flex",
      flexDirection: "column",
      gap,
    }}
  >
    {children}
  </div>
);

const AccentRail = ({
  top,
  left,
  height = 300,
  delay = 0,
}: {
  top: number;
  left: number;
  height?: number;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 130);

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 6,
        height,
        borderRadius: 999,
        background: `linear-gradient(180deg, ${colors.orange}, rgba(249,115,22,0.08))`,
        boxShadow: "0 16px 38px rgba(249,115,22,0.16)",
        opacity: clamp(enter, 0, 1),
        transform: `scaleY(${0.88 + enter * 0.12})`,
        transformOrigin: "top",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -10,
          left: "50%",
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: colors.white,
          border: `5px solid ${colors.orange}`,
          transform: "translateX(-50%)",
          boxShadow: "0 10px 26px rgba(249,115,22,0.20)",
        }}
      />
    </div>
  );
};

const SceneBadge = ({
  icon,
  children,
  delay = 0,
  style,
}: {
  icon: IconName;
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 130);

  return (
    <div
      style={{
        position: "absolute",
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        width: "max-content",
        padding: "10px 15px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.88)",
        border: "1px solid rgba(249,115,22,0.16)",
        boxShadow: "0 14px 34px rgba(15,23,42,0.07)",
        color: colors.slateMuted,
        fontSize: 15,
        fontWeight: 900,
        letterSpacing: 0.35,
        textTransform: "uppercase",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 10}px) scale(${0.96 + enter * 0.04})`,
        ...style,
      }}
    >
      <Icon name={icon} size={17} color={colors.orangeDark} />
      {children}
    </div>
  );
};

const InsightBadge = ({
  icon,
  label,
  value,
  delay = 0,
  width = 360,
  style,
}: {
  icon: IconName;
  label: string;
  value: string;
  delay?: number;
  width?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 130);

  return (
    <div
      style={{
        position: "absolute",
        width,
        padding: "18px 20px",
        borderRadius: 28,
        background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(255,247,237,0.90))",
        border: "1px solid rgba(249,115,22,0.16)",
        boxShadow: "0 22px 54px rgba(15,23,42,0.09), 0 12px 32px rgba(249,115,22,0.08)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 16}px) scale(${0.96 + enter * 0.04})`,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 16,
            background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
            display: "grid",
            placeItems: "center",
            flex: "0 0 auto",
            boxShadow: "0 14px 28px rgba(249,115,22,0.22)",
          }}
        >
          <Icon name={icon} size={22} color={colors.white} />
        </div>
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 950,
              color: colors.orangeDark,
              letterSpacing: 0.6,
              textTransform: "uppercase",
            }}
          >
            {label}
          </div>
          <div
            style={{
              marginTop: 5,
              fontSize: 22,
              lineHeight: 1.08,
              fontWeight: 950,
              letterSpacing: -0.4,
              color: colors.slate,
            }}
          >
            {value}
          </div>
        </div>
      </div>
    </div>
  );
};

const FlowStrip = ({
  steps,
  delay = 0,
  style,
}: {
  steps: string[];
  delay?: number;
  style?: React.CSSProperties;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 24, 130);

  return (
    <div
      style={{
        position: "absolute",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 14px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(249,115,22,0.14)",
        boxShadow: "0 16px 36px rgba(15,23,42,0.07)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 12}px)`,
        ...style,
      }}
    >
      {steps.map((step, index) => (
        <React.Fragment key={step}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "8px 11px",
              borderRadius: 999,
              background: index === steps.length - 1 ? colors.orangePale : "#f8fafc",
              color: index === steps.length - 1 ? colors.orangeDark : colors.slateMuted,
              fontSize: 14,
              fontWeight: 900,
              whiteSpace: "nowrap",
            }}
          >
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background: index === steps.length - 1 ? colors.orange : "rgba(100,116,139,0.12)",
                color: index === steps.length - 1 ? colors.white : colors.slateMuted,
                fontSize: 11,
              }}
            >
              {index + 1}
            </span>
            {step}
          </div>
          {index < steps.length - 1 && (
            <div style={{ width: 10, height: 2, borderRadius: 999, background: "rgba(249,115,22,0.28)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const StepList = ({
  steps,
  delay,
  stagger = 8,
}: {
  steps: Array<{ icon: IconName; title: string; text: string }>;
  delay: number;
  stagger?: number;
}) => (
  <>
    {steps.map((step, index) => (
      <InfoCard
        key={step.title}
        icon={step.icon}
        title={step.title}
        text={step.text}
        delay={delay + index * stagger}
        accent={index === 0}
      />
    ))}
  </>
);

const MiniOrderCard = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 20, 125);

  return (
    <div
      style={{
        width: 470,
        padding: 28,
        borderRadius: 34,
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(34,197,94,0.16)",
        boxShadow: "0 30px 76px rgba(15,23,42,0.14)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 22}px) scale(${0.94 + enter * 0.06})`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 58,
            height: 58,
            borderRadius: 20,
            background: colors.greenSoft,
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="check" size={27} color={colors.green} />
        </div>
        <div>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: colors.slate,
              lineHeight: 1,
            }}
          >
            Novo pedido recebido
          </div>
          <div
            style={{
              marginTop: 7,
              fontSize: 18,
              fontWeight: 700,
              color: colors.slateMuted,
            }}
          >
            Pedido #1042 · Lanches da Capivara
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 22,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        <div style={{ padding: "15px 16px", borderRadius: 22, background: "#f8fafc" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Total
          </div>
          <div style={{ marginTop: 6, fontSize: 24, fontWeight: 900, color: colors.slate }}>
            R$ 33,60
          </div>
        </div>

        <div style={{ padding: "15px 16px", borderRadius: 22, background: colors.greenSoft }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "rgba(22,163,74,0.74)", textTransform: "uppercase", letterSpacing: 0.5 }}>
            Status
          </div>
          <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: colors.green }}>
            Agora
          </div>
        </div>

        <div style={{ padding: "15px 16px", borderRadius: 22, background: colors.orangePale }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pagamento
          </div>
          <div style={{ marginTop: 6, fontSize: 21, fontWeight: 900, color: colors.orangeDark }}>
            Pix
          </div>
        </div>

        <div style={{ padding: "15px 16px", borderRadius: 22, background: "#f8fafc" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Canal
          </div>
          <div style={{ marginTop: 6, fontSize: 21, fontWeight: 900, color: colors.slate }}>
            Link da loja
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          padding: "17px 19px",
          borderRadius: 22,
          background: colors.orangePale,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ fontSize: 19, fontWeight: 800, color: colors.slate }}>
          Atendimento
        </span>
        <span style={{ fontSize: 19, fontWeight: 900, color: colors.orangeDark }}>
          Aguardando confirmação
        </span>
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
        fontWeight: 900,
        letterSpacing: -0.4,
        whiteSpace: "nowrap",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 16}px) scale(${0.95 + enter * 0.05})`,
      }}
    >
      <Icon name="link" size={28} color={colors.white} />
      {children}
    </div>
  );
};

/** Barra de progresso global do Reel — usa o frame absoluto da composição. */
const TopProgress = () => {
  const frame = useCurrentFrame();
  const scenes = Object.keys(TIMELINE) as SceneKey[];

  return (
    <div style={{ position: "absolute", top: 72, left: 82, right: 82, display: "flex", gap: 8, zIndex: 50 }}>
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

/** Grão filmico discreto, aplicado uma única vez sobre toda a composição. */
const GrainOverlay = () => (
  <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "soft-light", opacity: 0.045, zIndex: 60 }}>
    <svg width="100%" height="100%">
      <filter id="pb-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} stitchTiles="stitch" result="noise" />
        <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#pb-grain)" />
    </svg>
  </AbsoluteFill>
);

/**
 * Flash curto no início de cada cena — dá intenção ao corte seco entre
 * cenas (em vez de um jump-cut "cru"), sem reintroduzir o problema de tela
 * quase vazia que o fade-out anterior causava. Dura ~7 frames (~0.23s).
 */
const CutFlash = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 1, 7], [0, 0.55, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: colors.white,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Efeito sonoro pontual. `at` é o mesmo "delay" (em frame LOCAL) usado pelo
 * elemento visual que esse som acompanha — som e imagem nascem juntos.
 */
const SoundEffect = ({ src, at, volume = 0.6 }: { src: string; at: number; volume?: number }) => (
  <Sequence from={at} layout="none">
    <Audio src={staticFile(src)} volume={volume} />
  </Sequence>
);

/** Trilha de fundo: toca o Reel inteiro, em loop, com fade-in/out. */
const BackgroundBed = () => {
  const bedVolume = (frame: number) =>
    interpolate(
      frame,
      [0, 24, VIDEO.durationInFrames - 28, VIDEO.durationInFrames],
      [0, 0.42, 0.42, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
    );

  return (
    <Sequence from={0} durationInFrames={VIDEO.durationInFrames} name="Trilha de fundo" layout="none">
      <Audio src={staticFile(assets.audio.bed)} loop volume={bedVolume} />
    </Sequence>
  );
};

// ---------------------------------------------------------------------------
// Cenas
// ---------------------------------------------------------------------------
// useCurrentFrame() aqui já é LOCAL: cada cena vive dentro de um <Sequence>
// (ver PratoByReel, ao final), então os "delay" abaixo são sempre relativos
// ao início da própria cena. As cenas ficaram ~33% mais longas (20s no
// total) — as animações continuam terminando nos mesmos "delay", o tempo
// extra é "fôlego" de leitura no final de cada cena, o que é desejável em
// vídeo comercial (dá tempo do espectador absorver a mensagem).

const SceneOne = () => {
  const frame = useCurrentFrame();
  const phoneY = interpolate(frame, [0, 64], [70, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="hook">
      <SoundEffect src={assets.audio.cash} at={5} volume={0.52} />
      <SoundEffect src={assets.audio.whooshDeep} at={18} volume={0.4} />
      <SoundEffect src={assets.audio.pop} at={28} volume={0.42} />

      <AccentRail top={SAFE_TOP + 150} left={60} height={510} delay={8} />
      <SceneBadge icon="store" delay={12} style={{ top: SAFE_TOP + 4, right: 82 }}>
        SaaS white-label
      </SceneBadge>

      <div style={{ position: "absolute", top: SAFE_TOP, left: 82 }}>
        <Brand />
        <Tagline delay={4}>Cardápio Digital - Pedidos sem Comissão.</Tagline>
      </div>

      <div style={{ position: "absolute", top: SAFE_TOP + 145, left: 82, width: 560 }}>
        <Eyebrow delay={5} icon="money">Sem comissão por pedido</Eyebrow>
        <div style={{ marginTop: 38 }}>
          <Headline delay={9} size={76} maxWidth={720}>
            Seu delivery online,
            <br />
            <span style={{ color: colors.orange }}>sem comissão.</span>
          </Headline>
          <Subhead delay={15} maxWidth={500}>
            Venda online pelo seu próprio link, sem pagar comissão por pedido.
          </Subhead>
        </div>
      </div>

      <StackColumn top={960} left={82} width={420} gap={16}>
        <InfoCard
          icon="store"
          title="Sua loja no seu canal"
          text="Cardápio, carrinho e checkout em uma experiência própria para vender pelo celular."
          delay={26}
          accent
        />
        <ChecklistItem delay={36}>Seu link na bio, no Instagram e no WhatsApp</ChecklistItem>
        <ChecklistItem delay={44}>Mais margem sem taxa por pedido</ChecklistItem>
      </StackColumn>

      <InsightBadge
        icon="link"
        label="Canal próprio"
        value="Cardápio, pedidos e painel no mesmo sistema"
        delay={52}
        width={430}
        style={{ top: 1284, left: 82 }}
      />

      <div
        style={{
          position: "absolute",
          right: -112,
          top: 430,
          transform: `translateY(${phoneY}px)`,
        }}
      >
        <PhoneMockup
          src={assets.storeTop}
          delay={18}
          width={500}
          height={1120}
          objectPosition="top center"
          scale={1.03}
          rotate={-2}
        />
      </div>
    </SceneContainer>
  );
};

const SceneTwo = () => {
  const frame = useCurrentFrame();
  const panY = interpolate(frame, [20, 84], [44, 24], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="storefront">
      <SoundEffect src={assets.audio.whooshSoft} at={15} volume={0.42} />
      <SoundEffect src={assets.audio.pop} at={24} volume={0.4} />

      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 60,
          left: 82,
          right: 82,
          textAlign: "center",
        }}
      >
        <SceneBadge
          icon="phone"
          delay={10}
          style={{ top: 284, left: 0, right: 0, margin: "0 auto" }}
        >
          Mobile-first
        </SceneBadge>
        <Headline delay={5} size={66} maxWidth={900} align="center">
          Uma loja bonita
          <br />
          para vender no celular.
        </Headline>
        <Subhead delay={11} maxWidth={770} align="center">
          Cardápio claro, busca rápida e carrinho sempre visível para o cliente pedir sem atrito.
        </Subhead>
      </div>

      <div style={{ position: "absolute", left: 48, top: 535 }}>
        <PhoneMockup
          src={assets.productListDock}
          delay={15}
          width={455}
          height={1240}
          objectPosition="top center"
          scale={1.03}
          panY={panY}
        />
      </div>

      <StackColumn top={620} right={68} width={410}>
        <StepList
          delay={24}
          stagger={10}
          steps={[
            { icon: "search", title: "Busca rápida", text: "O cliente encontra produtos sem perder tempo rolando a tela." },
            { icon: "store", title: "Categorias organizadas", text: "O cardápio fica fácil de navegar mesmo com muitos itens." },
            { icon: "cart", title: "Carrinho sempre visível", text: "Resumo do pedido e valor aparecem no momento certo da compra." },
          ]}
        />
      </StackColumn>

      <InsightBadge
        icon="cart"
        label="Compra mais fluida"
        value="Busca, categorias e carrinho trabalhando juntos"
        delay={54}
        width={410}
        style={{ top: 1088, right: 68 }}
      />
    </SceneContainer>
  );
};

const SceneThree = () => {
  const frame = useCurrentFrame();
  const panY = interpolate(frame, [18, 76], [0, -50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cartPulse = interpolate(Math.sin(frame / 7), [-1, 1], [0.992, 1.03]);

  return (
    <SceneContainer scene="product">
      <SoundEffect src={assets.audio.whooshFast} at={16} volume={0.36} />
      <SoundEffect src={assets.audio.pop} at={28} volume={0.4} />

      <AccentRail top={SAFE_TOP + 76} left={60} height={318} delay={6} />
      <SceneBadge icon="cart" delay={14} style={{ top: 535, left: 82 }}>
        Fluxo de compra guiado
      </SceneBadge>

      <div style={{ position: "absolute", top: SAFE_TOP + 70, left: 82, width: 570 }}>
        <Headline delay={5} size={64} maxWidth={620}>
          O cliente finaliza em poucos toques.
        </Headline>
        <Subhead delay={11} maxWidth={560}>
          Produto, adicionais, observações e checkout simples no mesmo fluxo de compra.
        </Subhead>
      </div>

      <StackColumn top={650} left={82} width={400}>
        <StepList
          delay={26}
          stagger={10}
          steps={[
            { icon: "order", title: "Adicionais e observações", text: "O pedido fica completo antes de chegar na operação." },
            { icon: "money", title: "Subtotal claro", text: "O cliente entende o valor antes de finalizar." },
            { icon: "cart", title: "Checkout simples", text: "Menos atrito para concluir a compra e enviar o pedido." },
          ]}
        />
      </StackColumn>

      <div style={{ position: "absolute", right: 82, top: 500 }}>
        <PlanTeaser delay={54} />
      </div>

      <FlowStrip
        steps={["Escolhe", "Personaliza", "Finaliza"]}
        delay={58}
        style={{ top: 1112, left: 82 }}
      />

      <div
        style={{
          position: "absolute",
          right: 10,
          bottom: -120,
          transform: `scale(${cartPulse})`,
        }}
      >
        <PhoneMockup
          src={assets.productModal}
          delay={16}
          width={530}
          height={1180}
          objectPosition="center center"
          scale={1.02}
          panY={panY}
          rotate={2}
        />
      </div>
    </SceneContainer>
  );
};

const SceneFour = () => {
  const frame = useCurrentFrame();

  const panY = interpolate(frame, [20, 72], [-14, -42], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <SceneContainer scene="order">
      <SoundEffect src={assets.audio.whoosh} at={18} volume={0.4} />
      <SoundEffect src={assets.audio.ding} at={28} volume={0.58} />

      <AccentRail top={SAFE_TOP + 72} left={60} height={300} delay={6} />
      <SceneBadge icon="panel" delay={14} style={{ top: 552, right: 68 }}>
        Painel do lojista
      </SceneBadge>

      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 66,
          left: 82,
          width: 790,
        }}
      >
        <Headline delay={5} size={62} maxWidth={790}>
          Pedido no painel,
          <br />
          operação no controle.
        </Headline>

        <Subhead delay={11} maxWidth={690}>
          Receba, acompanhe e atualize pedidos sem perder informação em conversas soltas.
        </Subhead>
      </div>

      <div
        style={{
          position: "absolute",
          left: -88,
          bottom: -185,
        }}
      >
        <PhoneMockup
          src={assets.productListDock}
          delay={18}
          width={455}
          height={1220}
          objectPosition="top center"
          scale={1.02}
          panY={panY}
          rotate={2}
        />
      </div>

      <div
        style={{
          position: "absolute",
          right: 68,
          top: 640,
        }}
      >
        <MiniOrderCard delay={28} />
      </div>

      <InsightBadge
        icon="panel"
        label="Operação em tempo real"
        value="Confirme, prepare e acompanhe sem perder contexto"
        delay={42}
        width={470}
        style={{ top: 1030, right: 68 }}
      />

      <StackColumn top={1180} right={68} width={470}>
        <StepList
          delay={48}
          stagger={10}
          steps={[
            {
              icon: "order",
              title: "Novo pedido recebido",
              text: "O pedido entra com total, canal e informações principais.",
            },
            {
              icon: "panel",
              title: "Status em tempo real",
              text: "Atualize o andamento e mantenha a operação no fluxo certo.",
            },
            {
              icon: "whatsapp",
              title: "Atendimento mais organizado",
              text: "Use a conversa como apoio, não como lugar para perder pedidos.",
            },
          ]}
        />
      </StackColumn>
    </SceneContainer>
  );
};

const MarketingPreviewCard = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = delayedSpring(frame, delay, fps, 24, 125);
  const floatY = interpolate(Math.sin(frame / 24), [-1, 1], [-4, 4]);

  return (
    <div
      style={{
        width: 860,
        height: 376,
        borderRadius: 42,
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, rgba(255,251,245,0.98), rgba(255,237,213,0.92))",
        border: "1px solid rgba(249,115,22,0.16)",
        boxShadow:
          "0 30px 82px rgba(15,23,42,0.13), 0 18px 46px rgba(249,115,22,0.12)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 22 + floatY}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <Img
        src={staticFile(assets.marketingCard)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "center",
          display: "block",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.18), transparent 36%, transparent 72%, rgba(15,23,42,0.06))",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          borderRadius: 42,
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
        }}
      />

      <div
        style={{
          position: "absolute",
          right: 22,
          bottom: 20,
          padding: "10px 14px",
          borderRadius: 999,
          background: "rgba(255,255,255,0.88)",
          border: "1px solid rgba(249,115,22,0.14)",
          boxShadow: "0 12px 28px rgba(15,23,42,0.08)",
          color: colors.orangeDark,
          fontSize: 14,
          fontWeight: 950,
          letterSpacing: 0.2,
        }}
      >
        Loja pública + painel do lojista
      </div>
    </div>
  );
};

const FinalProofBar = ({ delay = 0 }: { delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = delayedSpring(frame, delay, fps, 22, 120);

  return (
    <div
      style={{
        width: 860,
        padding: "20px 24px",
        borderRadius: 34,
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,247,237,0.92))",
        border: "1px solid rgba(249,115,22,0.14)",
        boxShadow: "0 22px 54px rgba(15,23,42,0.08)",
        opacity: clamp(enter, 0, 1),
        transform: `translateY(${(1 - enter) * 14}px) scale(${0.97 + enter * 0.03})`,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 34,
          right: 34,
          height: 4,
          borderRadius: "0 0 999px 999px",
          background: `linear-gradient(90deg, transparent, ${colors.orange}, transparent)`,
          opacity: 0.9,
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Link próprio
          </div>
          <div style={{ marginTop: 5, fontSize: 22, fontWeight: 950, color: colors.slate }}>
            Sua marca
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Pedidos
          </div>
          <div style={{ marginTop: 5, fontSize: 22, fontWeight: 950, color: colors.slate }}>
            Organizados
          </div>
        </div>

        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: colors.slateSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Comissão
          </div>
          <div style={{ marginTop: 5, fontSize: 22, fontWeight: 950, color: colors.orangeDark }}>
            Zero por pedido
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: "1px solid rgba(249,115,22,0.12)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 14,
          fontSize: 19,
          fontWeight: 850,
          color: colors.slateMuted,
        }}
      >
        <span style={{ color: colors.orangeDark, fontWeight: 950 }}>pratoby.com</span>
        <span>·</span>
        <span>@pratobybr</span>
        <span>·</span>
        <span>Teste grátis</span>
      </div>
    </div>
  );
};

const SceneFive = () => {
  return (
    <SceneContainer scene="cta">
      <SoundEffect src={assets.audio.pop} at={24} volume={0.42} />
      <SoundEffect src={assets.audio.cash} at={36} volume={0.34} />
      <SoundEffect src={assets.audio.chime} at={52} volume={0.62} />

      <div
        style={{
          position: "absolute",
          top: SAFE_TOP + 28,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Brand large center />
      </div>

      <div
        style={{
          position: "absolute",
          top: 292,
          left: 125,
          right: 90,
          textAlign: "center",
        }}
      >
        <Headline align="center" maxWidth={860} size={68} delay={8}>
          Seu cardápio
          <br />
          Seus pedidos
          <br />
          <span style={{ color: colors.orange }}>Zero comissão.</span>
        </Headline>

        <Subhead align="center" maxWidth={790} delay={16}>
          Uma forma mais profissional de vender online pelo seu próprio canal.
        </Subhead>
      </div>

      <SceneBadge
        icon="store"
        delay={20}
        style={{ top: 625, left: 0, right: 0, margin: "0 auto" }}
      >
        Cardápio + pedidos + painel
      </SceneBadge>

      <div
        style={{
          position: "absolute",
          top: 715,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <CTAButton delay={24}>Conheça o PratoBy</CTAButton>
      </div>

      <div
        style={{
          position: "absolute",
          top: 875,
          left: 84,
          right: 84,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
        }}
      >
        <FeaturePill icon="check" delay={34} variant="orange">
          Sem comissão por pedido
        </FeaturePill>

        <FeaturePill icon="link" delay={40}>
          Seu próprio link
        </FeaturePill>

        <FeaturePill icon="order" delay={46}>
          Pedidos organizados
        </FeaturePill>

        <FeaturePill icon="panel" delay={52}>
          Painel do lojista
        </FeaturePill>
      </div>

      <div
        style={{
          position: "absolute",
          top: 1065,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <MarketingPreviewCard delay={42} />
      </div>
      <div
        style={{
          position: "absolute",
          top: 1486,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <FinalProofBar delay={58} />
      </div>
    </SceneContainer>
  );
};

export const PratoByReel = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.cream, fontFamily }}>
      <BackgroundBed />
      <Sequence from={TIMELINE.hook.start} durationInFrames={sceneLength("hook")} name={TIMELINE.hook.label}>
        <SceneOne />
      </Sequence>
      <Sequence from={TIMELINE.storefront.start} durationInFrames={sceneLength("storefront")} name={TIMELINE.storefront.label}>
        <SceneTwo />
      </Sequence>
      <Sequence from={TIMELINE.product.start} durationInFrames={sceneLength("product")} name={TIMELINE.product.label}>
        <SceneThree />
      </Sequence>
      <Sequence from={TIMELINE.order.start} durationInFrames={sceneLength("order")} name={TIMELINE.order.label}>
        <SceneFour />
      </Sequence>
      <Sequence
        from={TIMELINE.cta.start}
        durationInFrames={sceneLength("cta")}
        name={TIMELINE.cta.label}
      >
        <SceneFive />
      </Sequence>
      <TopProgress />
      {/* Camada de grão unificando todas as cenas com um acabamento filmico.
          Remova esta linha se precisar reduzir o tempo de renderização. */}
      <GrainOverlay />
    </AbsoluteFill>
  );
};

export const pratoByReelMetadata = VIDEO;
