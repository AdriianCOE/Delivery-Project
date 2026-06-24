import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const colors = {
  orange: '#f97316',
  orangeDark: '#ea580c',
  slate: '#0f172a',
  slateMuted: '#64748b',
  warm: '#fff7ed',
  white: '#ffffff',
  green: '#22c55e',
  red: '#ef4444',
};

const fontFamily =
  'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

type IconName = 'cart' | 'clock' | 'store' | 'order' | 'whatsapp' | 'bell' | 'check';

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const sceneOpacity = (frame: number, start: number, end: number) => {
  const fadeIn = interpolate(frame, [start, start + 12], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const fadeOut = interpolate(frame, [end - 12, end], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return Math.min(fadeIn, fadeOut);
};

const sceneLocalFrame = (frame: number, start: number) => Math.max(0, frame - start);

const Icon = ({name, size = 34, color = colors.orange}: {name: IconName; size?: number; color?: string}) => {
  const common = {
    fill: 'none',
    stroke: color,
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      {name === 'cart' && (
        <>
          <path {...common} d="M4 5h2l2 10h9l2-7H7" />
          <circle {...common} cx="10" cy="20" r="1.4" />
          <circle {...common} cx="17" cy="20" r="1.4" />
        </>
      )}
      {name === 'clock' && (
        <>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M12 8v5l3 2" />
        </>
      )}
      {name === 'store' && (
        <>
          <path {...common} d="M4 10h16l-1.5-5h-13L4 10Z" />
          <path {...common} d="M6 10v9h12v-9" />
          <path {...common} d="M9 19v-5h6v5" />
        </>
      )}
      {name === 'order' && (
        <>
          <path {...common} d="M7 4h10v16H7z" />
          <path {...common} d="M9.5 8h5" />
          <path {...common} d="M9.5 12h5" />
          <path {...common} d="M9.5 16h3" />
        </>
      )}
      {name === 'whatsapp' && (
        <>
          <path {...common} d="M5 19l1-3a7 7 0 1 1 2.8 2.5L5 19Z" />
          <path {...common} d="M9.5 9.5c.7 2.1 2 3.4 4 4" />
        </>
      )}
      {name === 'bell' && (
        <>
          <path {...common} d="M6 17h12l-1.2-2v-4a4.8 4.8 0 0 0-9.6 0v4L6 17Z" />
          <path {...common} d="M10 19a2 2 0 0 0 4 0" />
        </>
      )}
      {name === 'check' && <path {...common} d="M5 13l4 4L19 7" />}
    </svg>
  );
};

export const SceneContainer = ({
  children,
  start,
  end,
  accent = 'orange',
}: {
  children: React.ReactNode;
  start: number;
  end: number;
  accent?: 'orange' | 'green';
}) => {
  const frame = useCurrentFrame();
  const opacity = sceneOpacity(frame, start, end);
  const y = interpolate(frame, [start, start + 18], [26, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        opacity,
        transform: `translateY(${y}px)`,
        background:
          accent === 'orange'
            ? `radial-gradient(circle at 82% 16%, rgba(249,115,22,0.22), transparent 34%),
               radial-gradient(circle at 12% 80%, rgba(234,88,12,0.12), transparent 36%),
               linear-gradient(160deg, #fff7ed 0%, #ffffff 48%, #ffedd5 100%)`
            : `radial-gradient(circle at 78% 18%, rgba(34,197,94,0.17), transparent 34%),
               linear-gradient(160deg, #ffffff 0%, #fff7ed 56%, #f8fafc 100%)`,
        fontFamily,
        color: colors.slate,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 56,
          borderRadius: 58,
          border: '1px solid rgba(249,115,22,0.12)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </AbsoluteFill>
  );
};

export const FeaturePill = ({
  children,
  icon,
  delay = 0,
}: {
  children: React.ReactNode;
  icon?: IconName;
  delay?: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {damping: 18, stiffness: 120, mass: 0.8},
  });

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '16px 22px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.86)',
        boxShadow: '0 18px 42px rgba(15,23,42,0.10)',
        border: '1px solid rgba(249,115,22,0.14)',
        transform: `scale(${0.92 + pop * 0.08})`,
        opacity: clamp(pop, 0, 1),
        fontSize: 28,
        fontWeight: 850,
        color: colors.slate,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <Icon name={icon} size={28} />}
      {children}
    </div>
  );
};

export const CTAButton = ({children}: {children: React.ReactNode}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(Math.sin(frame / 11), [-1, 1], [0.98, 1.025]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '26px 44px',
        borderRadius: 999,
        color: colors.white,
        background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
        boxShadow: '0 28px 70px rgba(234,88,12,0.28)',
        fontSize: 34,
        fontWeight: 950,
        transform: `scale(${pulse})`,
      }}
    >
      {children}
    </div>
  );
};

export const FloatingOrderCard = ({
  title,
  subtitle,
  icon,
  top,
  left,
  delay,
}: {
  title: string;
  subtitle: string;
  icon: IconName;
  top: number;
  left: number;
  delay: number;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {damping: 20, stiffness: 110},
  });
  const float = Math.sin((frame + delay) / 18) * 7;

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: 330,
        padding: 22,
        borderRadius: 30,
        background: 'rgba(255,255,255,0.88)',
        border: '1px solid rgba(255,255,255,0.78)',
        boxShadow: '0 24px 60px rgba(15,23,42,0.13)',
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        opacity: enter,
        transform: `translateY(${(1 - enter) * 28 + float}px) scale(${0.92 + enter * 0.08})`,
      }}
    >
      <div
        style={{
          width: 58,
          height: 58,
          borderRadius: 20,
          background: 'rgba(249,115,22,0.10)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Icon name={icon} size={32} />
      </div>
      <div>
        <div style={{fontSize: 24, fontWeight: 950, color: colors.slate}}>{title}</div>
        <div style={{fontSize: 19, fontWeight: 750, color: colors.slateMuted, marginTop: 4}}>{subtitle}</div>
      </div>
    </div>
  );
};

export const PhoneMockup = ({
  variant = 'menu',
  delay = 0,
  highlightCart = false,
}: {
  variant?: 'menu' | 'dashboard';
  delay?: number;
  highlightCart?: boolean;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = spring({
    frame: Math.max(0, frame - delay),
    fps,
    config: {damping: 22, stiffness: 105},
  });
  const cartPulse = highlightCart ? interpolate(Math.sin(frame / 5), [-1, 1], [1, 1.06]) : 1;

  return (
    <div
      style={{
        width: 500,
        height: 980,
        borderRadius: 62,
        padding: 18,
        background: '#111827',
        boxShadow: '0 50px 120px rgba(15,23,42,0.27)',
        transform: `translateY(${(1 - enter) * 120}px) scale(${0.92 + enter * 0.08})`,
        opacity: enter,
      }}
    >
      <div
        style={{
          height: '100%',
          borderRadius: 48,
          background: variant === 'menu' ? '#fff7ed' : '#f8fafc',
          overflow: 'hidden',
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.22)',
        }}
      >
        <div
          style={{
            height: 132,
            background:
              variant === 'menu'
                ? `linear-gradient(135deg, ${colors.orange}, #fb923c)`
                : 'linear-gradient(135deg, #0f172a, #334155)',
            padding: 26,
            color: colors.white,
          }}
        >
          <div style={{fontSize: 22, fontWeight: 850, opacity: 0.9}}>
            {variant === 'menu' ? 'Doce Capivara' : 'Painel PratoBy'}
          </div>
          <div style={{fontSize: 34, fontWeight: 980, marginTop: 8}}>
            {variant === 'menu' ? 'Cardápio online' : 'Pedidos em tempo real'}
          </div>
        </div>

        {variant === 'menu' ? (
          <div style={{padding: 24}}>
            <div
              style={{
                height: 56,
                borderRadius: 999,
                background: colors.white,
                boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
                display: 'flex',
                alignItems: 'center',
                padding: '0 20px',
                gap: 12,
                color: colors.slateMuted,
                fontSize: 20,
                fontWeight: 800,
              }}
            >
              <Icon name="store" size={24} />
              Buscar produtos
            </div>

            {[0, 1, 2].map((item) => (
              <div
                key={item}
                style={{
                  marginTop: 22,
                  padding: 18,
                  borderRadius: 30,
                  background: colors.white,
                  boxShadow: '0 16px 36px rgba(15,23,42,0.08)',
                  display: 'flex',
                  gap: 18,
                  alignItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: 28,
                    background:
                      item === 0
                        ? 'linear-gradient(135deg, #fed7aa, #fb923c)'
                        : item === 1
                          ? 'linear-gradient(135deg, #fde68a, #f59e0b)'
                          : 'linear-gradient(135deg, #fecaca, #ef4444)',
                  }}
                />
                <div style={{flex: 1}}>
                  <div style={{fontSize: 24, fontWeight: 950, color: colors.slate}}>
                    {item === 0 ? 'Burger artesanal' : item === 1 ? 'Combo especial' : 'Sobremesa'}
                  </div>
                  <div style={{fontSize: 18, fontWeight: 700, color: colors.slateMuted, marginTop: 7}}>
                    Adicionais e observações
                  </div>
                  <div
                    style={{
                      marginTop: 14,
                      display: 'inline-flex',
                      padding: '11px 18px',
                      borderRadius: 999,
                      background: item === 0 ? colors.orange : '#ffedd5',
                      color: item === 0 ? colors.white : colors.orangeDark,
                      fontSize: 18,
                      fontWeight: 950,
                    }}
                  >
                    Adicionar
                  </div>
                </div>
              </div>
            ))}

            <div
              style={{
                position: 'absolute',
                left: 48,
                right: 48,
                bottom: 36,
                height: 76,
                borderRadius: 999,
                background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                fontSize: 22,
                fontWeight: 980,
                boxShadow: '0 18px 42px rgba(234,88,12,0.28)',
                transform: `scale(${cartPulse})`,
              }}
            >
              <Icon name="cart" size={30} color={colors.white} />
              Carrinho · R$ 48,90
            </div>
          </div>
        ) : (
          <div style={{padding: 24}}>
            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16}}>
              {['Hoje', 'Pedidos'].map((label, index) => (
                <div
                  key={label}
                  style={{
                    padding: 20,
                    borderRadius: 26,
                    background: colors.white,
                    boxShadow: '0 12px 30px rgba(15,23,42,0.08)',
                  }}
                >
                  <div style={{fontSize: 18, color: colors.slateMuted, fontWeight: 800}}>{label}</div>
                  <div style={{fontSize: 34, color: colors.slate, fontWeight: 980, marginTop: 8}}>
                    {index === 0 ? 'R$ 842' : '18'}
                  </div>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: 28,
                padding: 22,
                borderRadius: 30,
                background: colors.white,
                border: '2px solid rgba(34,197,94,0.20)',
                boxShadow: '0 20px 44px rgba(15,23,42,0.10)',
              }}
            >
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <div style={{fontSize: 25, fontWeight: 980}}>Pedido #1042</div>
                <div
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: 'rgba(34,197,94,0.12)',
                    color: '#15803d',
                    fontSize: 16,
                    fontWeight: 950,
                  }}
                >
                  Novo pedido
                </div>
              </div>
              <div style={{marginTop: 20, display: 'grid', gap: 12}}>
                {['2x Burger artesanal', '1x Batata crocante', 'Pagamento online'].map((line) => (
                  <div
                    key={line}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontSize: 20,
                      fontWeight: 780,
                      color: colors.slateMuted,
                    }}
                  >
                    <Icon name="check" size={22} color={colors.green} />
                    {line}
                  </div>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 26,
                padding: 20,
                borderRadius: 28,
                background: '#0f172a',
                color: colors.white,
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              <Icon name="bell" size={30} color={colors.orange} />
              Notificação em tempo real
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Brand = ({large = false}: {large?: boolean}) => (
  <div style={{display: 'flex', alignItems: 'center', gap: large ? 20 : 14}}>
    <div
      style={{
        width: large ? 92 : 56,
        height: large ? 92 : 56,
        borderRadius: large ? 30 : 18,
        background: colors.white,
        display: 'grid',
        placeItems: 'center',
        boxShadow: '0 16px 40px rgba(234,88,12,0.18)',
        overflow: 'hidden',
      }}
    >
      <Img src={staticFile('pratoby-mark-96.png')} style={{width: '76%', height: '76%', objectFit: 'contain'}} />
    </div>
    <div style={{fontSize: large ? 76 : 40, fontWeight: 1000, letterSpacing: -2, color: colors.slate}}>
      PratoBy
    </div>
  </div>
);

const Headline = ({children, maxWidth = 820}: {children: React.ReactNode; maxWidth?: number}) => (
  <h1
    style={{
      margin: 0,
      maxWidth,
      fontSize: 76,
      lineHeight: 0.92,
      letterSpacing: -4,
      color: colors.slate,
      fontWeight: 1000,
    }}
  >
    {children}
  </h1>
);

const Subhead = ({children, maxWidth = 720}: {children: React.ReactNode; maxWidth?: number}) => (
  <p
    style={{
      margin: '26px 0 0',
      maxWidth,
      fontSize: 32,
      lineHeight: 1.18,
      color: colors.slateMuted,
      fontWeight: 780,
    }}
  >
    {children}
  </p>
);

const SceneOne = () => {
  const frame = useCurrentFrame();
  const local = sceneLocalFrame(frame, 0);
  const phoneY = interpolate(local, [0, 38], [210, 0], {extrapolateRight: 'clamp'});

  return (
    <SceneContainer start={0} end={96}>
      <div style={{position: 'absolute', top: 112, left: 88}}>
        <Brand />
      </div>
      <div style={{position: 'absolute', top: 270, left: 88}}>
        <Headline>Seu delivery ainda depende de apps com comissão?</Headline>
        <Subhead>Venda direto pelo seu próprio link.</Subhead>
      </div>
      <div style={{position: 'absolute', left: 445, bottom: -95, transform: `translateY(${phoneY}px) rotate(-5deg)`}}>
        <PhoneMockup delay={8} />
      </div>
      <FloatingOrderCard title="Pedido online" subtitle="sem intermediário" icon="order" top={920} left={90} delay={22} />
      <FloatingOrderCard title="Carrinho pronto" subtitle="checkout em cliques" icon="cart" top={1110} left={146} delay={34} />
    </SceneContainer>
  );
};

const SceneTwo = () => {
  const frame = useCurrentFrame();
  const local = sceneLocalFrame(frame, 90);
  const itemMove = interpolate(local, [28, 62], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <SceneContainer start={90} end={186}>
      <div style={{position: 'absolute', top: 154, left: 88}}>
        <Headline>Cardápio digital bonito, rápido e pronto para vender.</Headline>
        <Subhead>Produtos, adicionais, carrinho e checkout em poucos cliques.</Subhead>
      </div>
      <div style={{position: 'absolute', right: 96, bottom: 130}}>
        <PhoneMockup delay={96} highlightCart />
      </div>
      <div
        style={{
          position: 'absolute',
          left: interpolate(itemMove, [0, 1], [124, 668]),
          top: interpolate(itemMove, [0, 1], [1050, 1430]),
          opacity: interpolate(itemMove, [0, 0.82, 1], [0, 1, 0]),
          transform: `scale(${interpolate(itemMove, [0, 1], [1, 0.34])}) rotate(${interpolate(itemMove, [0, 1], [-8, 10])}deg)`,
        }}
      >
        <div
          style={{
            width: 112,
            height: 112,
            borderRadius: 32,
            background: 'linear-gradient(135deg, #fed7aa, #fb923c)',
            boxShadow: '0 20px 50px rgba(234,88,12,0.26)',
          }}
        />
      </div>
    </SceneContainer>
  );
};

const SceneThree = () => (
  <SceneContainer start={180} end={276} accent="green">
    <div style={{position: 'absolute', top: 150, left: 88}}>
      <Headline>Pedidos chegam direto no painel do lojista.</Headline>
      <Subhead>Controle status, pagamentos e atendimento em tempo real.</Subhead>
    </div>
    <div style={{position: 'absolute', left: 88, bottom: 118}}>
      <PhoneMockup variant="dashboard" delay={188} />
    </div>
    <FloatingOrderCard title="Novo pedido" subtitle="notificação instantânea" icon="bell" top={900} left={600} delay={205} />
    <FloatingOrderCard title="WhatsApp" subtitle="atendimento direto" icon="whatsapp" top={1098} left={650} delay={220} />
  </SceneContainer>
);

const SceneFour = () => {
  const frame = useCurrentFrame();
  const local = sceneLocalFrame(frame, 270);
  const strike = interpolate(local, [24, 48], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <SceneContainer start={270} end={366}>
      <div style={{position: 'absolute', top: 210, left: 88}}>
        <Headline maxWidth={760}>Sem comissão por pedido.</Headline>
        <Subhead>Mais controle para sua loja. Mais margem para o seu negócio.</Subhead>
      </div>

      <div style={{position: 'absolute', left: 88, right: 88, top: 770, display: 'grid', gap: 30}}>
        <div
          style={{
            position: 'relative',
            padding: 36,
            borderRadius: 42,
            background: 'rgba(255,255,255,0.72)',
            border: '1px solid rgba(239,68,68,0.16)',
            color: colors.slateMuted,
            fontSize: 38,
            fontWeight: 950,
            boxShadow: '0 20px 60px rgba(15,23,42,0.08)',
          }}
        >
          Apps com comissão
          <div
            style={{
              position: 'absolute',
              left: 30,
              top: '50%',
              width: `${strike * 62}%`,
              height: 6,
              borderRadius: 999,
              background: colors.red,
              transform: 'rotate(-4deg)',
              transformOrigin: 'left center',
            }}
          />
        </div>

        <div
          style={{
            padding: 42,
            borderRadius: 46,
            background: `linear-gradient(135deg, ${colors.orange}, ${colors.orangeDark})`,
            color: colors.white,
            fontSize: 46,
            fontWeight: 1000,
            boxShadow: '0 34px 80px rgba(234,88,12,0.28)',
          }}
        >
          Seu delivery próprio
          <div style={{fontSize: 26, fontWeight: 820, opacity: 0.88, marginTop: 12}}>pedido online no seu link</div>
        </div>
      </div>
    </SceneContainer>
  );
};

const SceneFive = () => {
  const frame = useCurrentFrame();
  const local = sceneLocalFrame(frame, 360);
  const brandEnter = interpolate(local, [0, 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

  return (
    <SceneContainer start={360} end={450}>
      <div
        style={{
          position: 'absolute',
          top: 260,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          opacity: brandEnter,
          transform: `translateY(${(1 - brandEnter) * 22}px) scale(${0.96 + brandEnter * 0.04})`,
        }}
      >
        <Brand large />
      </div>
      <div style={{position: 'absolute', top: 488, left: 120, right: 120, textAlign: 'center'}}>
        <Subhead maxWidth={840}>Cardápio digital e delivery próprio para vender mais.</Subhead>
      </div>
      <div style={{position: 'absolute', top: 720, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <CTAButton>Comece pelo seu próprio link</CTAButton>
      </div>
      <div
        style={{
          position: 'absolute',
          top: 940,
          left: 74,
          right: 74,
          display: 'flex',
          justifyContent: 'center',
          gap: 18,
          flexWrap: 'wrap',
        }}
      >
        <FeaturePill icon="check" delay={374}>Sem comissão</FeaturePill>
        <FeaturePill icon="cart" delay={384}>Pedidos online</FeaturePill>
        <FeaturePill icon="store" delay={394}>Painel do lojista</FeaturePill>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 190,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 34,
          fontWeight: 950,
          color: colors.orangeDark,
        }}
      >
        pratoby.com
      </div>
    </SceneContainer>
  );
};

export const PratoByReel = () => {
  return (
    <AbsoluteFill style={{backgroundColor: colors.warm}}>
      <SceneOne />
      <SceneTwo />
      <SceneThree />
      <SceneFour />
      <SceneFive />
    </AbsoluteFill>
  );
};
