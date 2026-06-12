import { motion } from 'motion/react'
import {
  ArrowRight,
  ExternalLink,
  Heart,
  Link as LinkIcon,
  ShoppingCart,
  Star,
  TrendingUp,
} from 'lucide-react'

const EXAMPLE_URL = 'https://pratoby.com/capivaras-lanches'
const EXAMPLE_LABEL = 'pratoby.com/capivaras-lanches'

const CAPIVARA_LOGO =
  'https://res.cloudinary.com/dsionrn26/image/upload/f_auto,q_auto,w_64,h_64,c_fill/v1778007863/borapedir/capivaras-lanches/branding/logoUrl/spu3llgr354fvcqshgmd.png'

const menuItems = [
  {
    name: 'Capivara Clássico',
    description: 'Pão brioche, blend artesanal, queijo e molho da casa.',
    price: 'R$ 28,00',
    oldPrice: 'R$ 32,00',
    badge: 'Popular',
    image: 'https://res.cloudinary.com/dsionrn26/image/upload/q_auto/f_auto/v1779426519/burguer_srbdst.png',
  },
  {
    name: 'Batata Rústica',
    description: 'Porção crocante com tempero especial e molho exclusivo.',
    price: 'R$ 16,00',
    oldPrice: '',
    badge: 'Destaque',
    image:
      'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ2EIlmcWfSfEeLI19XjB-n1mLnjc0gVWSpmw&s',
  },
  {
    name: 'Refrigerante lata',
    description: 'Escolha Coca-Cola, Guaraná ou Pepsi no pedido.',
    price: 'R$ 6,00',
    oldPrice: '',
    badge: 'Opções',
    image: 'https://res.cloudinary.com/dsionrn26/image/upload/q_auto/f_auto/v1779426519/refri_ueqyna.png',
  },
]

export function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[390px] shrink-0">
      
      {/* BADGE ESQUERDO */}
<motion.div
  initial={{ opacity: 0, y: 12, rotate: -6, scale: 0.96 }}
  animate={{
    opacity: 1,
    y: [0, -7, 0],
    rotate: [-5, -3, -5],
    scale: 1,
  }}
  transition={{
    opacity: { delay: 0.55, duration: 0.35 },
    scale: { delay: 0.55, duration: 0.35 },
    y: { delay: 0.9, duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
    rotate: { delay: 0.9, duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
  }}
  className="absolute left-2 top-1 z-30 max-w-[158px] origin-bottom-right rounded-[1.15rem] border border-orange-100 bg-white/95 px-3 py-2 shadow-xl shadow-orange-100/70 backdrop-blur-xl sm:-left-4 sm:-top-6 sm:max-w-[210px] sm:rounded-[1.4rem] sm:px-4 sm:py-3 sm:shadow-2xl lg:-left-20"
>
  <div className="flex items-center gap-1.5 text-[10px] font-black text-[#111827] sm:gap-2 sm:text-xs">
    <LinkIcon size={13} className="text-[#f97316] sm:size-[14px]" />
    Link na bio
  </div>

  <p className="mt-1 truncate text-[10px] font-bold text-[#6b7280] sm:text-xs">
    {EXAMPLE_LABEL}
  </p>
</motion.div>

{/* BADGE DIREITO */}
<motion.div
  initial={{ opacity: 0, y: 14, rotate: 5, scale: 0.96 }}
  animate={{
    opacity: 1,
    y: [0, -8, 0],
    rotate: [4, 2, 4],
    scale: 1,
  }}
  transition={{
    opacity: { delay: 0.75, duration: 0.35 },
    scale: { delay: 0.75, duration: 0.35 },
    y: { delay: 1.05, duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
    rotate: { delay: 1.05, duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
  }}
  className="absolute bottom-32 right-2 z-30 max-w-[165px] origin-bottom-left rounded-[1.15rem] border border-green-100 bg-white/95 px-3 py-2 shadow-xl shadow-green-100/70 backdrop-blur-xl sm:bottom-40 sm:right-0 sm:max-w-[220px] sm:rounded-[1.4rem] sm:px-4 sm:py-3 sm:shadow-2xl lg:-right-20 lg:bottom-44"
>
  <div className="mb-1.5 flex items-center gap-1.5 sm:mb-2 sm:gap-2">
    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse sm:h-2.5 sm:w-2.5" />
    <span className="text-[10px] font-black text-[#111827] sm:text-xs">
      Pedido recebido
    </span>
  </div>

  <p className="text-lg font-black text-[#111827] sm:text-2xl">
    R$ 89,80
  </p>

  <div className="mt-1 flex items-center gap-1.5 sm:mt-1.5 sm:gap-2">
    <TrendingUp size={13} className="text-green-600 sm:size-[14px]" />
    <span className="text-[10px] font-black text-green-600 sm:text-xs">
      0% taxa
    </span>
  </div>
</motion.div>

      {/* O CELULAR EM SI */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="relative z-10 mx-auto w-[280px] sm:w-[320px] shrink-0"
      >
        {/* CARCAÇA DO CELULAR COM ASPECT RATIO TRAVADO (Evita esticar no mobile) */}
        <div className="relative aspect-[1/2.15] w-full rounded-[3rem] sm:rounded-[3.5rem] bg-[#111827] p-2 sm:p-2.5 shadow-2xl shadow-gray-300/70 ring-1 ring-gray-900/10">
          
          {/* Botões Físicos Laterais */}
          <div className="absolute -left-[3px] top-24 h-6 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -left-[3px] top-36 h-12 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -left-[3px] top-52 h-12 w-[3px] rounded-l-md bg-gray-800" />
          <div className="absolute -right-[3px] top-40 h-16 w-[3px] rounded-r-md bg-gray-800" />

          {/* BARRA DE STATUS (Horário, Notch e Bateria) */}
          <div className="absolute top-4 sm:top-5 inset-x-5 sm:inset-x-6 z-40 flex items-center justify-between pointer-events-none">
            
            {/* Horário (Padrão 9:41) */}
            <div className="w-12 text-center text-[10px] sm:text-[11px] font-black text-white tracking-wide ml-1">
              9:41
            </div>

            {/* Dynamic Island (Notch Moderno) */}
            <div className="h-6 sm:h-7 w-24 sm:w-28 rounded-full bg-[#111827] shadow-inner shrink-0" />

            {/* Ícones de Sistema (Sinal, Wifi, Bateria) */}
            <div className="w-12 flex items-center justify-end gap-1.5 mr-1">
              {/* Ícone de Sinal */}
              <div className="flex items-end gap-[1.5px] h-2.5 opacity-90">
                <div className="w-[2.5px] h-1 bg-white rounded-sm" />
                <div className="w-[2.5px] h-1.5 bg-white rounded-sm" />
                <div className="w-[2.5px] h-2 bg-white rounded-sm" />
                <div className="w-[2.5px] h-2.5 bg-white rounded-sm" />
              </div>
              {/* Ícone de Wifi */}
              <svg className="w-[11px] h-[11px] text-white fill-current opacity-90" viewBox="0 0 24 24">
                <path d="M12.01 21.49L23.64 7c-.45-.34-4.93-4-11.64-4C5.28 3 .81 6.66.36 7l11.63 14.49.01.01.01-.01z"/>
              </svg>
              {/* Ícone de Bateria (80%) */}
              <div className="flex items-center opacity-90">
                <div className="h-[10px] sm:h-[11px] w-[18px] sm:w-[20px] rounded-[3px] border border-white/60 p-[1px] flex">
                  <div className="h-full w-[80%] rounded-[1.5px] bg-white" />
                </div>
                <div className="h-1 w-0.5 bg-white/60 rounded-r-sm" />
              </div>
            </div>
            
          </div>
          {/* TELA DO CELULAR (Flex Column para rolar só o meio) */}
          <div className="relative flex h-full w-full flex-col overflow-hidden rounded-[2.5rem] sm:rounded-[3rem] bg-[#f9fafb]">
            
            {/* HEADER DA LOJA (Fixo no topo) */}
            <div className="relative shrink-0 overflow-hidden px-4 pb-5 pt-10 sm:pt-12 text-white">
              <div
                className="absolute inset-0 scale-110 bg-cover bg-center opacity-45 blur-[1px]"
                style={{ backgroundImage: `url(${CAPIVARA_LOGO})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-br from-[#111827]/95 via-[#111827]/88 to-[#f97316]/70" />
              <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />

              <div className="relative flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-lg">
                    <img
                      src={CAPIVARA_LOGO}
                      alt="Capivara's Lanches"
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-black">
                      Capivara&apos;s Lanches
                    </p>
                    <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] font-bold text-white/70">
                      Aberta · Hoje até 20:00
                    </p>
                  </div>
                </div>

                <div className="flex h-8 w-8 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                  <Heart size={15} className="sm:w-[17px] sm:h-[17px]" />
                </div>
              </div>

              <div className="relative mt-4 sm:mt-5 grid grid-cols-3 gap-2">
                {[
                  ['Pedido', 'Rápido'],
                  ['Pix', 'QR Code'],
                  ['Link', 'Exclusivo'],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl bg-white/10 p-2 sm:p-3 backdrop-blur-md">
                    <p className="text-[9px] sm:text-[10px] font-bold text-white/55">{label}</p>
                    <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm font-black">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* LISTA DE PRODUTOS (Área que rola / Scrollable) */}
            <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4 [&::-webkit-scrollbar]:hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base sm:text-lg font-black text-[#111827]">Hambúrgueres</p>
                  <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-semibold text-[#6b7280]">
                    Exemplo de cardápio real
                  </p>
                </div>
                <span className="rounded-full bg-white px-2.5 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-black text-[#6b7280] ring-1 ring-gray-100">
                  3 itens
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
                {['Mais pedidos', 'Promoções', 'Bebidas'].map((item, index) => (
                  <span
                    key={item}
                    className={`shrink-0 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-black ${
                      index === 0
                        ? 'bg-[#f97316] text-white'
                        : 'bg-white text-[#6b7280] ring-1 ring-gray-100'
                    }`}
                  >
                    {item}
                  </span>
                ))}
              </div>

              <div className="space-y-3 pb-2">
                {menuItems.map((item, index) => (
                  <div
                    key={item.name}
                    className="flex gap-2 sm:gap-3 rounded-[1.2rem] sm:rounded-[1.4rem] border border-gray-100 bg-white p-2.5 sm:p-3 shadow-sm"
                  >
                    <div className="relative flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-[0.8rem] sm:rounded-[1rem] bg-gray-50">
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="h-full w-full object-contain p-1"
                      />
                      {index === 0 && (
                        <span className="absolute bottom-1 sm:bottom-2 left-1 sm:left-2 rounded-full bg-red-500 px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[9px] font-black text-white shadow-sm">
                          -13%
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-xs sm:text-sm font-black text-[#111827]">
                            {item.name}
                          </p>
                          <span className="rounded-full bg-orange-50 px-1.5 sm:px-2 py-0.5 sm:py-1 text-[8px] sm:text-[9px] font-black text-[#f97316] shrink-0">
                            {item.badge}
                          </span>
                        </div>
                        <p className="mt-0.5 sm:mt-1 line-clamp-2 text-[10px] sm:text-[11px] font-semibold leading-[1.1rem] text-[#6b7280]">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          {item.oldPrice && (
                            <p className="text-[9px] sm:text-[10px] font-bold text-gray-400 line-through">
                              {item.oldPrice}
                            </p>
                          )}
                          <p className="text-xs sm:text-sm font-black text-[#111827]">
                            {item.price}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="rounded-[0.8rem] sm:rounded-[1rem] bg-[#f97316] px-2.5 sm:px-3 py-1.5 sm:py-2 text-[10px] sm:text-[11px] font-black text-white shadow-sm active:scale-95 transition-transform"
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* BOTÃO DO CARRINHO (Fixo embaixo do scroll) */}
            <div className="shrink-0 bg-white p-3 sm:p-4 border-t border-gray-100">
              <div className="rounded-[1rem] sm:rounded-[1.3rem] bg-[#111827] px-3 sm:px-4 py-2.5 sm:py-3 text-white shadow-lg active:scale-[0.98] transition-transform cursor-pointer">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShoppingCart size={15} className="sm:w-[17px] sm:h-[17px]" />
                    <div>
                      <p className="text-[11px] sm:text-xs font-black">Carrinho</p>
                      <p className="mt-0.5 text-[9px] sm:text-[11px] font-bold text-white/60">
                        3 itens escolhidos
                      </p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm font-black">R$ 50,00</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </motion.div>

      {/* BOTÃO "VER EXEMPLO REAL" (Abaixo do celular) */}
      <a
        href={EXAMPLE_URL}
        target="_blank"
        rel="noreferrer"
        className="group relative mt-8 block overflow-hidden rounded-[1.75rem] border border-orange-100 bg-white p-[1px] shadow-xl shadow-orange-100/60 transition duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-orange-200/70"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-orange-100 via-white to-orange-50 opacity-80" />
        <div className="relative rounded-[1.65rem] bg-gradient-to-br from-white to-orange-50/70 px-4 sm:px-5 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-100/70 px-2.5 sm:px-3 py-1 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.18em] text-[#f97316]">
                <ExternalLink size={12} className="sm:w-[13px] sm:h-[13px]" />
                Ver exemplo real
              </div>
              <p className="mt-2 sm:mt-3 truncate text-base sm:text-lg font-black tracking-tight text-[#111827]">
                pratoby.com/<span className="text-[#f97316]">capivaras-lanches</span>
              </p>
              <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs font-bold text-[#6b7280]">
                Cardápio de demonstração aberto em nova aba
              </p>
            </div>
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-[#f97316] text-white shadow-lg shadow-orange-600/25 transition duration-300 group-hover:scale-105">
              <ArrowRight size={18} className="sm:w-5 sm:h-5" />
            </div>
          </div>
        </div>
      </a>

      <div className="pointer-events-none absolute right-7 top-20 hidden rounded-full bg-white px-3 py-1.5 text-[10px] font-black text-[#f97316] shadow-lg shadow-orange-100 ring-1 ring-orange-100 sm:flex">
        <Star size={12} className="mr-1 fill-[#f97316]" />
        Exemplo real
      </div>
    </div>
  )
}
