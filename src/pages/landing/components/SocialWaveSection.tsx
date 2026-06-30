import { motion } from 'motion/react'
import { FiArrowUpRight, FiCheckCircle } from 'react-icons/fi'
import { RiInstagramFill, RiWhatsappFill } from 'react-icons/ri'
import type { IconType } from 'react-icons'

const WHATSAPP_URL = `https://wa.me/5579998681594?text=${encodeURIComponent(
  'Olá! Vim pelo site do PratoBy e quero saber mais.'
)}`

type SocialChannel = {
  name: string
  handle: string
  href: string
  icon: IconType
  iconClassName: string
  description: string
  cta: string
}

const socialChannels: SocialChannel[] = [
  {
    name: 'Instagram',
    handle: '@pratobybr',
    href: 'https://www.instagram.com/pratobybr',
    icon: RiInstagramFill,
    iconClassName:
      'bg-gradient-to-br from-pink-500 via-orange-500 to-amber-400 shadow-orange-200',
    description:
      'Dicas práticas, bastidores e novidades para quem vende comida online.',
    cta: 'Seguir no Instagram',
  },
  {
    name: 'WhatsApp',
    handle: 'Atendimento PratoBy',
    href: WHATSAPP_URL,
    icon: RiWhatsappFill,
    iconClassName:
      'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-200',
    description:
      'Fale com nosso time para tirar dúvidas sobre o PratoBy e os próximos passos.',
    cta: 'Falar com o time',
  },
]

const contentTopics = [
  'Dicas para vender mais',
  'Novidades do produto',
  'Conteúdo para lojistas',
]

export function SocialWaveSection() {
  return (
    <section className="relative isolate overflow-hidden bg-white py-16 lg:py-24">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#f8fafc] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-20 h-72 w-72 rounded-full bg-orange-100/70 blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.55 }}
            className="max-w-xl"
          >
            <p className="text-sm font-black uppercase tracking-[0.16em] text-[#f97316]">
              PratoBy nas redes
            </p>

            <h2 className="mt-4 text-3xl font-black leading-tight tracking-tight text-[#111827] sm:text-4xl lg:text-5xl">
              Conteúdo para deixar seu delivery{' '}
              <span className="text-[#f97316]">sempre em movimento.</span>
            </h2>

            <p className="mt-5 max-w-lg text-base font-semibold leading-8 text-[#64748b] sm:text-lg">
              Acompanhe ideias práticas, atualizações do produto e conteúdos
              pensados para a rotina de quem vende comida online.
            </p>

            <ul className="mt-7 grid gap-3 text-sm font-bold text-[#475569] sm:grid-cols-2 lg:grid-cols-1">
              {contentTopics.map((topic) => (
                <li key={topic} className="flex items-center gap-2.5">
                  <FiCheckCircle
                    size={17}
                    className="shrink-0 text-[#f97316]"
                    aria-hidden="true"
                  />
                  {topic}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, delay: 0.08 }}
            className="overflow-hidden rounded-[2rem] border border-orange-100 bg-[#fffaf5] p-2 shadow-[0_24px_70px_rgba(15,23,42,0.08)] sm:p-3"
          >
            {socialChannels.map((channel, index) => {
              const Icon = channel.icon

              return (
                <a
                  key={channel.name}
                  href={channel.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${channel.cta} — ${channel.handle}`}
                  className={`group flex flex-col gap-5 rounded-[1.55rem] px-4 py-5 transition duration-300 hover:bg-white hover:shadow-[0_14px_36px_rgba(15,23,42,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fffaf5] sm:flex-row sm:items-center sm:px-5 sm:py-6 ${
                    index < socialChannels.length - 1
                      ? 'border-b border-orange-100/80'
                      : ''
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${channel.iconClassName}`}
                  >
                    <Icon size={27} aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="text-xl font-black text-[#111827]">
                        {channel.name}
                      </h3>
                      <span className="text-xs font-black uppercase tracking-wide text-[#94a3b8]">
                        {channel.handle}
                      </span>
                    </div>

                    <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#64748b]">
                      {channel.description}
                    </p>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black text-[#f97316] transition-transform duration-300 group-hover:translate-x-1">
                    {channel.cta}
                    <FiArrowUpRight size={17} aria-hidden="true" />
                  </span>
                </a>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
