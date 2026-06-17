import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  FiArrowRight as ArrowRight,
  FiExternalLink as ExternalLink,
  FiHeart as Heart,
  FiLink as LinkIcon,
  FiShoppingCart as ShoppingCart,
  FiStar as Star,
  FiTrendingUp as TrendingUp,
} from 'react-icons/fi'
import type { IconType } from 'react-icons'

const EXAMPLE_PATH = '/capivaras-lanches'
const EXAMPLE_LABEL = 'pratoby.com/capivaras-lanches'

const CLOUDINARY_BASE = 'https://res.cloudinary.com/dsionrn26/image/upload'
const DEMO_IMAGE_TRANSFORM = 'f_auto,q_auto:eco,c_fit,w_112,h_112'
const LOGO_TRANSFORM = 'f_auto,q_auto:eco,w_64,h_64,c_fill'

const CAPIVARA_LOGO = `${CLOUDINARY_BASE}/${LOGO_TRANSFORM}/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png`
const BATATA_RUSTICA_IMAGE = 'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fit,w_112,h_112/v1781665744/LEGBATATAINGLESAPNG_lfzril.webp'

type MenuItem = {
  name: string
  description: string
  price: string
  oldPrice?: string
  badge: string
  discount?: string
  image?: string
  emoji?: string
  imageClassName?: string
}

type FloatingBadgeProps = {
  side: 'left' | 'right'
  children: React.ReactNode
  prefersReducedMotion?: boolean
}

const menuItems: MenuItem[] = [
  {
    name: 'Capivara Clássico',
    description: 'Pão brioche, blend artesanal, queijo e molho da casa.',
    price: 'R$ 28,00',
    oldPrice: 'R$ 32,00',
    badge: 'Popular',
    discount: '-13%',
    image: `${CLOUDINARY_BASE}/${DEMO_IMAGE_TRANSFORM}/v1779426519/burguer_srbdst.png`,
  },
  {
    name: 'Batata Rústica',
    description: 'Porção crocante com tempero especial e molho exclusivo.',
    price: 'R$ 16,00',
    badge: 'Destaque',
    image: BATATA_RUSTICA_IMAGE,
  },
  {
    name: 'Refrigerante lata',
    description: 'Escolha Coca-Cola, Guaraná ou Pepsi no pedido.',
    price: 'R$ 6,00',
    badge: 'Opções',
    image: `${CLOUDINARY_BASE}/${DEMO_IMAGE_TRANSFORM}/v1779426519/refri_ueqyna.png`,
    imageClassName: 'p-2',
  },
]

const categoryTabs = ['Mais pedidos', 'Promoções', 'Bebidas']

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function SignalIcon() {
  return (
    <div className="flex h-2.5 items-end gap-[1.5px] opacity-90" aria-hidden="true">
      <div className="h-1 w-[2.5px] rounded-sm bg-white" />
      <div className="h-1.5 w-[2.5px] rounded-sm bg-white" />
      <div className="h-2 w-[2.5px] rounded-sm bg-white" />
      <div className="h-2.5 w-[2.5px] rounded-sm bg-white" />
    </div>
  )
}

function WifiIcon() {
  return (
    <svg
      className="h-[11px] w-[11px] fill-current text-white opacity-90"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z" />
    </svg>
  )
}

function BatteryIcon() {
  return (
    <div className="flex items-center opacity-90" aria-hidden="true">
      <div className="flex h-[10px] w-[18px] rounded-[3px] border border-white/60 p-[1px] sm:h-[11px] sm:w-[20px]">
        <div className="h-full w-[80%] rounded-[1.5px] bg-white" />
      </div>
      <div className="h-1 w-0.5 rounded-r-sm bg-white/60" />
    </div>
  )
}

function FloatingBadge({ side, children, prefersReducedMotion = false }: FloatingBadgeProps) {
  const isLeft = side === 'left'

  return (
    <motion.div
      initial={
        prefersReducedMotion
          ? false
          : {
              opacity: 0,
              x: isLeft ? -10 : 10,
              y: 16,
              rotate: isLeft ? -8 : 7,
              scale: 0.94,
            }
      }
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : {
              opacity: 1,
              x: isLeft ? [-2, 5, -2] : [2, -5, 2],
              y: isLeft ? [0, -18, 0] : [0, -20, 0],
              rotate: isLeft ? [-7, -2, -7] : [6, 1, 6],
              scale: 1,
            }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0.2 }
          : {
              opacity: { delay: isLeft ? 0.35 : 0.55, duration: 0.35 },
              scale: { delay: isLeft ? 0.35 : 0.55, duration: 0.35 },
              x: {
                delay: isLeft ? 0.75 : 0.95,
                duration: isLeft ? 3.4 : 3.7,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'easeInOut',
              },
              y: {
                delay: isLeft ? 0.75 : 0.95,
                duration: isLeft ? 3.4 : 3.7,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'easeInOut',
              },
              rotate: {
                delay: isLeft ? 0.75 : 0.95,
                duration: isLeft ? 3.4 : 3.7,
                repeat: Infinity,
                repeatType: 'loop',
                ease: 'easeInOut',
              },
            }
      }
      style={{ willChange: 'transform, opacity' }}
      className={cx(
        'absolute z-30 max-w-[165px] rounded-[1.15rem] border bg-white/95 px-3 py-2 shadow-xl backdrop-blur-xl dark:bg-zinc-900/95 sm:max-w-[220px] sm:rounded-[1.4rem] sm:px-4 sm:py-3 sm:shadow-2xl',
        isLeft
          ? 'left-2 top-1 origin-bottom-right border-orange-100 shadow-orange-100/70 dark:border-orange-500/20 dark:shadow-black/20 sm:-left-4 sm:-top-6 lg:-left-20'
          : 'bottom-32 right-2 origin-bottom-left border-green-100 shadow-green-100/70 dark:border-emerald-500/20 dark:shadow-black/20 sm:bottom-40 sm:right-0 lg:-right-20 lg:bottom-44'
      )}
    >
      {children}
    </motion.div>
  )
}

function ProductImage({ item }: { item: MenuItem }) {
  if (!item.image) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 text-3xl ring-1 ring-orange-100/70">
        <span aria-hidden="true">{item.emoji || '🍽️'}</span>
      </div>
    )
  }

  return (
    <img
      src={item.image}
      alt={item.name}
      loading="lazy"
      decoding="async"
      width={112}
      height={112}
      className={cx('h-full w-full object-contain p-1', item.imageClassName)}
    />
  )
}

function ProductCard({ item }: { item: MenuItem }) {
  return (
    <article className="flex gap-2 rounded-[1.2rem] border border-gray-100 bg-white p-2.5 shadow-sm sm:gap-3 sm:rounded-[1.4rem] sm:p-3">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] bg-gray-50 sm:h-20 sm:w-20 sm:rounded-[1rem]">
        <ProductImage item={item} />

        {item.discount && (
          <span className="absolute bottom-1 left-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[8px] font-black text-white shadow-sm sm:bottom-2 sm:left-2 sm:px-2 sm:text-[9px]">
            {item.discount}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-xs font-black text-[#111827] sm:text-sm">
              {item.name}
            </p>

            <span className="shrink-0 rounded-full bg-orange-50 px-1.5 py-0.5 text-[8px] font-black text-[#f97316] sm:px-2 sm:py-1 sm:text-[9px]">
              {item.badge}
            </span>
          </div>

          <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-[1.1rem] text-[#6b7280] sm:mt-1 sm:text-[11px]">
            {item.description}
          </p>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div>
            {item.oldPrice && (
              <p className="text-[9px] font-bold text-gray-400 line-through sm:text-[10px]">
                {item.oldPrice}
              </p>
            )}

            <p className="text-xs font-black text-[#111827] sm:text-sm">{item.price}</p>
          </div>

          <span className="select-none rounded-[0.8rem] bg-[#f97316] px-2.5 py-1.5 text-[10px] font-black text-white shadow-sm sm:rounded-[1rem] sm:px-3 sm:py-2 sm:text-[11px]">
            Adicionar
          </span>
        </div>
      </div>
    </article>
  )
}

function StatusBadge({
  icon: Icon,
  label,
  value,
}: {
  icon?: IconType
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl bg-white/10 p-2 backdrop-blur-md sm:p-3">
      <p className="text-[9px] font-bold text-white/55 sm:text-[10px]">{label}</p>

      <p className="mt-0.5 flex items-center gap-1 text-xs font-black sm:mt-1 sm:text-sm">
        {Icon && <Icon size={13} aria-hidden="true" />}
        {value}
      </p>
    </div>
  )
}

function PhoneFrame({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <div className="relative aspect-[1/2.15] w-full rounded-[3rem] bg-[#111827] p-2 shadow-2xl shadow-gray-300/70 ring-1 ring-gray-900/10 dark:shadow-black/40 sm:rounded-[3.5rem] sm:p-2.5">
      <div className="absolute -left-[3px] top-24 h-6 w-[3px] rounded-l-md bg-gray-800" />
      <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-md bg-gray-800" />
      <div className="absolute -left-[3px] top-52 h-12 w-[3px] rounded-l-md bg-gray-800" />
      <div className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r-md bg-gray-800" />

      <div className="pointer-events-none absolute inset-x-5 top-4 z-40 flex items-center justify-between sm:inset-x-6 sm:top-5">
        <div className="ml-1 w-12 text-center text-[10px] font-black tracking-wide text-white sm:text-[11px]">
          9:41
        </div>

        <div className="h-6 w-24 shrink-0 rounded-full bg-[#111827] shadow-inner sm:h-7 sm:w-28" />

        <div className="mr-1 flex w-12 items-center justify-end gap-1.5">
          <SignalIcon />
          <WifiIcon />
          <BatteryIcon />
        </div>
      </div>

      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.5rem] bg-[#f9fafb] sm:rounded-[3rem]">
        <div className="relative shrink-0 overflow-hidden px-4 pb-5 pt-10 text-white sm:pt-12">
          <img
            src={CAPIVARA_LOGO}
            alt=""
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-[1px]"
          />

          <div className="absolute inset-0 bg-gradient-to-br from-[#111827]/95 via-[#111827]/88 to-[#f97316]/70" />
          <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg sm:h-12 sm:w-12">
                <img
                  src={CAPIVARA_LOGO}
                  alt="Capivara's Lanches"
                  width={64}
                  height={64}
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-black">Capivara&apos;s Lanches</p>
                <p className="mt-0.5 text-[10px] font-bold text-white/70 sm:mt-1 sm:text-[11px]">
                  Aberta · Hoje até 20:00
                </p>
              </div>
            </div>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white sm:h-10 sm:w-10">
              <Heart size={15} className="sm:h-[17px] sm:w-[17px]" aria-hidden="true" />
            </div>
          </div>

          <div className="relative mt-4 grid grid-cols-3 gap-2 sm:mt-5">
            <StatusBadge label="Pedido" value="Rápido" />
            <StatusBadge label="Pix" value="QR Code" />
            <StatusBadge label="Link" value="Exclusivo" />
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4 [&::-webkit-scrollbar]:hidden">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-base font-black text-[#111827] sm:text-lg">Hambúrgueres</p>
              <p className="mt-0.5 text-[10px] font-semibold text-[#6b7280] sm:mt-1 sm:text-xs">
                Exemplo de cardápio real
              </p>
            </div>

            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#6b7280] ring-1 ring-gray-100 sm:px-3 sm:py-1.5 sm:text-xs">
              3 itens
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
            {categoryTabs.map((item, index) => (
              <span
                key={item}
                className={cx(
                  'shrink-0 rounded-full px-3 py-1.5 text-[10px] font-black sm:px-4 sm:py-2 sm:text-xs',
                  index === 0
                    ? 'bg-[#f97316] text-white'
                    : 'bg-white text-[#6b7280] ring-1 ring-gray-100'
                )}
              >
                {item}
              </span>
            ))}
          </div>

          <div className="space-y-3 pb-2">
            {menuItems.map((item, index) => (
              <motion.div
                key={item.name}
                initial={prefersReducedMotion ? false : { opacity: 0, x: 18 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0.2 }
                    : { duration: 0.35, delay: 0.35 + index * 0.1, ease: 'easeOut' }
                }
              >
                <ProductCard item={item} />
              </motion.div>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-100 bg-white p-3 sm:p-4">
          <div className="rounded-[1rem] bg-[#111827] px-3 py-2.5 text-white shadow-lg sm:rounded-[1.3rem] sm:px-4 sm:py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShoppingCart size={15} className="sm:h-[17px] sm:w-[17px]" aria-hidden="true" />

                <div>
                  <p className="text-[11px] font-black sm:text-xs">Carrinho</p>
                  <p className="mt-0.5 text-[9px] font-bold text-white/60 sm:text-[11px]">
                    3 itens escolhidos
                  </p>
                </div>
              </div>

              <p className="text-xs font-black sm:text-sm">R$ 50,00</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PhoneMockup() {
  const prefersReducedMotion = Boolean(useReducedMotion())

  return (
    <div className="relative w-full max-w-[390px] shrink-0">
      <FloatingBadge side="left" prefersReducedMotion={Boolean(prefersReducedMotion)}>
        <div className="flex items-center gap-1.5 text-[10px] font-black text-[#111827] dark:text-zinc-100 sm:gap-2 sm:text-xs">
          <LinkIcon size={13} className="text-[#f97316] sm:size-[14px]" aria-hidden="true" />
          Link na bio
        </div>

        <p className="mt-1 truncate text-[10px] font-bold text-[#6b7280] dark:text-zinc-400 sm:text-xs">
          {EXAMPLE_LABEL}
        </p>
      </FloatingBadge>

      <FloatingBadge side="right" prefersReducedMotion={Boolean(prefersReducedMotion)}>
        <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2">
          <span className="h-2 w-2 rounded-full bg-green-500 sm:h-2.5 sm:w-2.5" />
          <span className="text-[10px] font-black text-[#111827] dark:text-zinc-100 sm:text-xs">
            Pedido recebido
          </span>
        </div>

        <p className="text-lg font-black text-[#111827] dark:text-zinc-100 sm:text-2xl">
          R$ 89,80
        </p>

        <div className="mt-1 flex items-center gap-1.5 sm:mt-1.5 sm:gap-2">
          <TrendingUp size={13} className="text-green-600 sm:size-[14px]" aria-hidden="true" />
          <span className="text-[10px] font-black text-green-600 sm:text-xs">0% taxa</span>
        </div>
      </FloatingBadge>

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18, rotate: -1.5 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : {
                opacity: 1,
                y: [0, -12, 0],
                rotate: [-1.5, 0.8, -1.5],
              }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.2 }
            : {
                opacity: { duration: 0.45, ease: 'easeOut' },
                y: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
                rotate: { duration: 4.6, repeat: Infinity, ease: 'easeInOut' },
              }
        }
        className="relative z-10 mx-auto w-[280px] shrink-0 sm:w-[320px]"
        aria-label="Demonstração visual de uma loja PratoBy em um celular"
      >
        <PhoneFrame prefersReducedMotion={Boolean(prefersReducedMotion)} />
      </motion.div>

      <Link
        to={EXAMPLE_PATH}
        className="group relative mt-8 block overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white p-[1px] shadow-xl shadow-orange-100/60 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-200/70 dark:border-orange-500/20 dark:bg-zinc-900 dark:shadow-black/20"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-white to-orange-50 opacity-80 dark:from-orange-500/15 dark:via-zinc-900 dark:to-orange-500/10" />

        <div className="relative rounded-[1.65rem] bg-gradient-to-br from-white to-orange-50/70 px-4 py-3 dark:from-zinc-900 dark:to-zinc-900 sm:px-5 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/70 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#f97316] dark:bg-orange-500/10 sm:px-3 sm:text-[10px]">
                <ExternalLink size={12} className="sm:h-[13px] sm:w-[13px]" aria-hidden="true" />
                Ver exemplo real
              </div>

              <p className="mt-2 truncate text-base font-black tracking-tight text-[#111827] dark:text-zinc-100 sm:mt-3 sm:text-lg">
                pratoby.com/<span className="text-[#f97316]">capivaras-lanches</span>
              </p>

              <p className="mt-0.5 text-[10px] font-bold text-[#6b7280] dark:text-zinc-400 sm:mt-1 sm:text-xs">
                Cardápio de demonstração do PratoBy
              </p>
            </div>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/25 transition duration-300 group-hover:scale-105 sm:h-12 sm:w-12">
              <ArrowRight size={18} className="sm:h-5 sm:w-5" aria-hidden="true" />
            </div>
          </div>
        </div>
      </Link>

      <div className="pointer-events-none absolute right-7 top-20 hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#f97316] shadow-lg shadow-orange-100 ring-1 ring-orange-100 dark:bg-zinc-900 dark:shadow-black/20 dark:ring-orange-500/20 sm:flex">
        <Star size={12} className="mr-1 fill-[#f97316]" aria-hidden="true" />
        Exemplo real
      </div>
    </div>
  )
}