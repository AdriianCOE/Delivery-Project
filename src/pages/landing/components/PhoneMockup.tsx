import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  FiArrowRight as ArrowRight,
  FiClock,
  FiHeart,
  FiLink as LinkIcon,
  FiMapPin,
  FiShoppingCart,
  FiStar as Star,
  FiExternalLink as ExternalLink,
  FiTrendingUp as TrendingUp,
} from 'react-icons/fi'
import type { ReactNode, SyntheticEvent } from 'react'

const STORE_PATH = '/capivaras-lanches'
const STORE_URL_LABEL = 'pratoby.com/capivaras-lanches'

const BANNER_IMAGE =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fill,w_720,h_460/v1781724006/download_qsopxa.png'

const STORE_LOGO =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fill,w_96,h_96/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png'

const BURGER_IMAGE =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fit,w_160,h_160/v1779426519/burguer_srbdst.png'

const BATATA_IMAGE =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fit,w_160,h_160/v1781665744/LEGBATATAINGLESAPNG_lfzril.webp'

const REFRI_IMAGE =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto:eco,c_fit,w_160,h_160/v1779426519/refri_ueqyna.png'

type Product = {
  name: string
  description: string
  price: string
  oldPrice?: string
  badges: string[]
  metaLeft: string
  metaRight: string
  image: string
}

const products: Product[] = [
  {
    name: 'Capivara Clássico',
    description: 'Pão brioche, blend artesanal, queijo e molho da casa.',
    price: 'R$ 28,00',
    oldPrice: 'R$ 32,00',
    badges: ['Popular', '-13%'],
    metaLeft: 'Com opções',
    metaRight: '20-30 min',
    image: BURGER_IMAGE,
  },
  {
    name: 'Batata Rústica',
    description: 'Porção crocante com tempero especial e molho exclusivo.',
    price: 'R$ 16,00',
    badges: ['Destaque'],
    metaLeft: 'Ideal para dividir',
    metaRight: 'Sai rápido',
    image: BATATA_IMAGE,
  },
  {
    name: 'Refrigerante lata',
    description: 'Coca-Cola, Guaraná ou Pepsi para completar seu pedido.',
    price: 'R$ 6,00',
    badges: ['Bebida'],
    metaLeft: '350ml',
    metaRight: 'Gelado',
    image: REFRI_IMAGE,
  },
]

const categories = [
  ['Todos', '18'],
  ['Hambúrgueres', '8'],
  ['Porções', '5'],
]

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function hideBrokenImage(event: SyntheticEvent<HTMLImageElement>) {
  event.currentTarget.style.opacity = '0'
}

function DetailPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex w-fit max-w-full shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-[#f1dfcf] bg-[#fffaf6] px-2.5 py-1.5 text-[9px] font-black leading-none text-[#6b7280] shadow-sm">
      {icon}
      <span className="truncate">{label}</span>
    </span>
  )
}

function ProductCard({ product, priority = false }: { product: Product; priority?: boolean }) {
  return (
    <article className="rounded-[1.15rem] border border-[#f0e2d7] bg-white p-2.5 shadow-[0_10px_28px_rgba(15,23,42,.06)]">
      <div className="flex gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            {product.badges.map((badge, index) => (
              <span
                key={`${product.name}-${badge}`}
                className={cx(
                  'inline-flex items-center rounded-full px-2 py-0.5 text-[8px] font-black',
                  badge.includes('%')
                    ? 'bg-red-50 text-red-500'
                    : index === 0
                      ? 'bg-orange-50 text-[#f97316]'
                      : 'bg-green-50 text-green-700'
                )}
              >
                {badge}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="truncate text-[13px] font-black leading-4 text-[#111827]">
                {product.name}
              </h4>
              <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[#6b7280]">
                {product.description}
              </p>
            </div>

            <button
              type="button"
              tabIndex={-1}
              aria-label={`Favoritar ${product.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-[#f0e3d8] bg-white text-[#94a3b8]"
            >
              <FiHeart size={13} />
            </button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[8px] font-black text-[#6b7280]">
              {product.metaLeft}
            </span>
            <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[8px] font-black text-[#6b7280]">
              {product.metaRight}
            </span>
          </div>

          <div className="mt-2.5 flex items-end justify-between gap-3">
            <div>
              {product.oldPrice ? (
                <p className="text-[9px] font-bold text-gray-400 line-through">
                  {product.oldPrice}
                </p>
              ) : null}
              <p className="text-[14px] font-black text-[#0f172a]">{product.price}</p>
            </div>

            <button
              type="button"
              tabIndex={-1}
              className="inline-flex h-8 items-center justify-center rounded-full bg-[#f97316] px-3.5 text-[10px] font-black text-white shadow-sm"
            >
              Adicionar
            </button>
          </div>
        </div>

        <div className="flex h-[5.75rem] w-[5.75rem] shrink-0 items-center justify-center overflow-hidden rounded-[1rem] bg-[#fff8f2] ring-1 ring-[#f5e8dc]">
          <img
            src={product.image}
            alt={product.name}
            width={92}
            height={92}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            onError={hideBrokenImage}
            className="h-full w-full object-contain p-1.5"
          />
        </div>
      </div>
    </article>
  )
}

function FloatingInsightCard({
  children,
  className,
  delay = 0,
  prefersReducedMotion,
}: {
  children: ReactNode
  className: string
  delay?: number
  prefersReducedMotion: boolean
}) {
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 1, y: 0, scale: 0.98 }}
      animate={
        prefersReducedMotion
          ? { opacity: 1 }
          : { opacity: 1, y: [0, -7, 0], scale: 1 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0.15 }
          : {
              scale: { duration: 0.35, delay },
              y: {
                duration: 4.8,
                delay,
                repeat: Infinity,
                repeatType: 'mirror',
                ease: 'easeInOut',
              },
            }
      }
      className={className}
      style={{ willChange: prefersReducedMotion ? undefined : 'transform' }}
    >
      {children}
    </motion.div>
  )
}

function FloatingInsights({ prefersReducedMotion }: { prefersReducedMotion: boolean }) {
  return (
    <div className="pointer-events-none hidden md:block">
      <FloatingInsightCard
        prefersReducedMotion={prefersReducedMotion}
        delay={0.25}
        className="absolute left-0 top-8 z-30 max-w-[240px] rounded-[1.15rem] border border-orange-100 bg-white/95 px-4 py-3 shadow-xl shadow-orange-100/70 backdrop-blur-xl dark:border-orange-500/20 dark:bg-zinc-900/95 dark:shadow-black/20 lg:-left-14 xl:-left-20"
      >
        <div className="flex items-center gap-2 text-xs font-black text-[#111827] dark:text-zinc-100">
          <LinkIcon size={14} className="text-[#f97316]" aria-hidden="true" />
          Link na bio
        </div>
        <p className="mt-1 whitespace-nowrap text-[11px] font-bold text-[#6b7280] dark:text-zinc-400">
          {STORE_URL_LABEL}
        </p>
      </FloatingInsightCard>

      <FloatingInsightCard
        prefersReducedMotion={prefersReducedMotion}
        delay={0.55}
        className="absolute bottom-32 right-0 z-30 rounded-[1.4rem] border border-green-100 bg-white/95 px-4 py-3 shadow-xl shadow-green-100/70 backdrop-blur-xl dark:border-emerald-500/20 dark:bg-zinc-900/95 dark:shadow-black/20 lg:-right-14 lg:bottom-40 xl:-right-20"
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-xs font-black text-[#111827] dark:text-zinc-100">
            Pedido recebido
          </span>
        </div>
        <p className="text-2xl font-black text-[#111827] dark:text-zinc-100">R$ 89,90</p>
        <div className="mt-1.5 flex items-center gap-2">
          <TrendingUp size={14} className="text-green-600" aria-hidden="true" />
          <span className="text-xs font-black text-green-600">0% taxa</span>
        </div>
      </FloatingInsightCard>
    </div>
  )
}

export function PhoneMockup() {
  const prefersReducedMotion = Boolean(useReducedMotion())

  return (
    <div className="relative mx-auto w-full max-w-[450px] sm:max-w-[430px] lg:max-w-[460px]">
      <FloatingInsights prefersReducedMotion={prefersReducedMotion} />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 18, rotate: -0.6, scale: 0.985 }}
        animate={
          prefersReducedMotion
            ? { opacity: 1 }
            : { opacity: 1, y: [0, -8, 0], rotate: [-0.6, 0.25, -0.6], scale: 1 }
        }
        transition={
          prefersReducedMotion
            ? { duration: 0.1 }
            : {
                opacity: { duration: 0.35, ease: 'easeOut' },
                scale: { duration: 0.45, ease: 'easeOut' },
                y: { duration: 5.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
                rotate: { duration: 5.8, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' },
              }
        }
        className="relative z-10 mx-auto w-[320px] max-w-[calc(100vw-2rem)] min-[390px]:w-[336px] sm:w-[304px] lg:w-[342px] xl:w-[356px]"
        aria-label="Mockup de loja PratoBy em celular"
        style={{ willChange: prefersReducedMotion ? undefined : 'transform' }}
      >
        <div className="relative aspect-[0.505] rounded-[3.2rem] bg-[#0f172a] p-2.5 shadow-[0_30px_80px_rgba(15,23,42,0.24)] ring-1 ring-black/10">
          <div className="absolute -left-[3px] top-24 h-7 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -left-[3px] top-52 h-12 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r-md bg-gray-800" />

          <div className="absolute inset-x-6 top-4 z-40 flex items-center justify-between text-white">
            <div className="text-[11px] font-black">15:30</div>
            <div className="h-7 w-28 rounded-full bg-black/80 shadow-inner" />
            <div className="flex items-center gap-0.5 text-[8px]" aria-hidden="true">
              <span className="h-1.5 w-2.5 rounded-sm bg-white" />
              <span className="h-2.5 w-3 rounded-sm border border-white" />
            </div>
          </div>

          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.8rem] bg-[#fffaf6]">
            <div className="relative h-[218px] shrink-0 overflow-hidden border-b border-[#f1dfcf] bg-[#fff3e8] sm:h-[230px]">
              <img
                src={BANNER_IMAGE}
                alt="Banner da loja"
                width={720}
                height={460}
                fetchPriority="high"
                decoding="async"
                onError={hideBrokenImage}
                className="absolute inset-0 h-full w-full object-cover"
              />

              <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-[#fffaf6]/90" />

              <div className="absolute inset-x-3 bottom-4 rounded-[1.45rem] border border-[#f3e2d5] bg-white p-3 shadow-[0_16px_36px_rgba(15,23,42,.13)] sm:inset-x-4 sm:bottom-5 sm:p-3.5">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#fff5ec] ring-1 ring-[#f4e2d5]">
                    <img
                      src={STORE_LOGO}
                      alt="Capivara's Lanches"
                      width={48}
                      height={48}
                      decoding="async"
                      onError={hideBrokenImage}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-[15px] font-black text-[#0f172a] sm:text-[16px]">
                          Capivara&apos;s Lanches
                        </h3>
                        <p className="mt-0.5 text-[10px] font-bold text-[#f97316]">
                          Aberto agora
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-green-50 px-2 py-1 text-[8px] font-black text-green-700">
                        Online
                      </span>
                    </div>

                    <p className="mt-1 line-clamp-2 text-[10px] font-semibold leading-4 text-[#64748b] sm:text-[11px]">
                      Hambúrgueres, porções e bebidas para pedir direto pelo link da loja.
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <DetailPill icon={<FiClock size={11} />} label="18:00 às 23:30" />
                      <DetailPill icon={<FiMapPin size={11} />} label="Aracaju" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-hidden px-3 pb-3 pt-3">
              <div className="mb-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map(([label, count], index) => (
                  <span
                    key={label}
                    className={cx(
                      'inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[10px] font-black',
                      index === 0
                        ? 'bg-[#f97316] text-white shadow-sm shadow-orange-200'
                        : 'border border-[#f3e2d3] bg-white text-[#475569]'
                    )}
                  >
                    {label}
                    <span className={cx('rounded-full px-1.5 py-0.5 text-[9px]', index === 0 ? 'bg-white/20' : 'bg-orange-50 text-[#f97316]')}>
                      {count}
                    </span>
                  </span>
                ))}
              </div>

              <div className="space-y-2.5">
                {products.map((product, index) => (
                  <ProductCard key={product.name} product={product} priority={index === 0} />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-[#f0dfd1] bg-white p-3">
              <div className="rounded-[1.15rem] bg-[#0f172a] px-4 py-3 text-white shadow-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <FiShoppingCart size={16} />
                    <div>
                      <p className="text-[12px] font-black">Carrinho</p>
                      <p className="text-[10px] font-bold text-white/65">
                        3 itens escolhidos
                      </p>
                    </div>
                  </div>

                  <p className="text-[15px] font-black">R$ 50,00</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <Link
        to={STORE_PATH}
        className="group relative z-20 mx-auto mt-5 block w-full max-w-[350px] overflow-hidden rounded-[1.35rem] border border-orange-100 bg-white p-[1px] shadow-xl shadow-orange-100/50 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-200/60 dark:border-orange-500/20 dark:bg-zinc-900 dark:shadow-black/20 sm:mt-6 sm:max-w-[460px] sm:rounded-[1.55rem]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-white to-orange-50 opacity-80 dark:from-orange-500/15 dark:via-zinc-900 dark:to-orange-500/10" />

        <div className="relative rounded-[1.25rem] bg-gradient-to-br from-white to-orange-50/70 px-4 py-3 dark:from-zinc-900 dark:to-zinc-900 sm:rounded-[1.45rem] sm:px-5 sm:py-4">
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
    </div>
  )
}
