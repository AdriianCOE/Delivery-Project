// ─────────────────────────────────────────────────────────────────────────────
// src/components/shared/DashboardPageHeader.jsx
//
// Header padronizado para todas as páginas do painel do lojista.
// Não contém lógica de negócio — é puramente visual/estrutural.
//
// Props:
//   title       string           Título da página (obrigatório)
//   description string           Subtítulo/descrição (opcional)
//   eyebrow     string           Texto menor acima do título (opcional)
//   icon        ReactIcon        Componente de ícone react-icons (opcional)
//   iconBg      string           Classes Tailwind do container do ícone
//   badge       object|ReactNode Badge de status ao lado do título (opcional)
//                                Como objeto: { label, color, dot, pulse }
//                                color: 'green'|'red'|'amber'|'orange'|'blue'|'gray'
//   actions     ReactNode        Botões/controles à direita (opcional)
//   children    ReactNode        Área extra abaixo — tabs, filtros (opcional)
//   maxWidth    string           Tailwind max-w-* (padrão: 'max-w-7xl')
//   border      boolean          Borda inferior (padrão: true)
//   sticky      boolean          Sticky top-0 (padrão: true)
//   className   string           Classes extras no <header>
// ─────────────────────────────────────────────────────────────────────────────

import { isValidElement } from 'react'

// ── Paleta de cores para badges ───────────────────────────────────────────────

const BADGE_PALETTES = {
  green:  { wrap: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200', dot: 'bg-emerald-500' },
  red:    { wrap: 'bg-red-50 text-red-700 ring-1 ring-red-200',             dot: 'bg-red-500'     },
  amber:  { wrap: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',       dot: 'bg-amber-500'   },
  orange: { wrap: 'bg-orange-50 text-[#f97316] ring-1 ring-orange-200',     dot: 'bg-[#f97316]'   },
  blue:   { wrap: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',          dot: 'bg-blue-500'    },
  gray:   { wrap: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',         dot: 'bg-gray-400'    },
}

// ── Sub-componente de badge ───────────────────────────────────────────────────

function StatusBadge({ badge }) {
  // Se já for um ReactNode, passa direto
  if (isValidElement(badge)) return badge

  const { label, color = 'green', dot = true, pulse = false } = badge
  const palette = BADGE_PALETTES[color] || BADGE_PALETTES.green

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black ${palette.wrap}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${palette.dot} ${pulse ? 'animate-pulse' : ''}`}
        />
      )}
      {label}
    </div>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function DashboardPageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  iconBg    = 'bg-orange-50 text-[#f97316]',
  badge,
  actions,
  children,
  maxWidth  = 'max-w-7xl',
  border    = true,
  sticky    = true,
  className = '',
}) {
  const headerClasses = [
    sticky ? 'sticky top-0 z-30' : '',
    border ? 'border-b border-gray-100' : '',
    'bg-[#f9fafb]/95 backdrop-blur-xl',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <header className={headerClasses}>
      <div className={`mx-auto ${maxWidth} px-4 py-4 sm:px-6 lg:px-8`}>

        {/* ── Linha principal: ícone + título + badge | ações ── */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          {/* ESQUERDA */}
          <div className="flex min-w-0 items-start gap-3 sm:items-center">

            {/* Ícone */}
            {Icon && (
              <div
                className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${iconBg}`}
                aria-hidden="true"
              >
                <Icon size={19} />
              </div>
            )}

            <div className="min-w-0">
              {/* Eyebrow */}
              {eyebrow && (
                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.15em] text-[#9ca3af]">
                  {eyebrow}
                </p>
              )}

              {/* Título + badge */}
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-[#111827]">
                  {title}
                </h1>
                {badge != null && <StatusBadge badge={badge} />}
              </div>

              {/* Descrição */}
              {description && (
                <p className="mt-0.5 text-sm font-medium leading-6 text-[#6b7280]">
                  {description}
                </p>
              )}
            </div>
          </div>

          {/* DIREITA: ações */}
          {actions != null && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
            </div>
          )}
        </div>

        {/* ── Linha extra (tabs, filtros rápidos, seletor de loja) ── */}
        {children != null && (
          <div className="mt-4 border-t border-gray-100 pt-4">
            {children}
          </div>
        )}
      </div>
    </header>
  )
}