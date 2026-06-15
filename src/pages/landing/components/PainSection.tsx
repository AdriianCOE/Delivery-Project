import { motion } from 'motion/react'
import { FaGhost as Ghost } from 'react-icons/fa6'
import {
  FiDatabase as Database,
  FiSlash as Ban,
  FiTrendingDown as TrendingDown,
} from 'react-icons/fi'

const problems = [
  {
    icon: TrendingDown,
    value: '27%',
    label: 'pode sair do seu lucro',
    description:
      'Em apps com comissão, cada pedido pode virar uma fatia grande da sua margem indo embora.',
  },
  {
    icon: Ban,
    value: 'Marca',
    label: 'em segundo plano',
    description:
      'O cliente lembra do aplicativo antes de lembrar da sua loja. A experiência não é realmente sua.',
  },
  {
    icon: Database,
    value: 'Dados',
    label: 'fora do seu controle',
    description:
      'Você vende, mas não constrói relacionamento direto com quem comprou de você.',
  },
]

export function PainSection() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#fff7ed]/50 to-[#f8fafc] py-8 lg:py-12">
      {/* Efeitos de Glow no fundo */}
      <div className="pointer-events-none absolute -left-32 top-10 h-72 w-72 rounded-full bg-red-100/50 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-orange-100/50 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        
        {/* Cabeçalho da Seção */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="mx-auto mb-8 max-w-3xl text-center lg:mb-10 flex flex-col items-center"
        >
          {/* Badge centralizado */}
          <div className="mx-auto inline-flex items-center justify-center gap-2 rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-black uppercase tracking-wide text-red-600 shadow-sm">
            <Ghost size={16} />
            O custo invisível dos apps
          </div>

          <h2 className="mt-5 text-3xl font-black leading-tight tracking-tight text-[#111827] sm:text-5xl">
            Apps de delivery tradicionais{' '}
            <span className="text-red-600">comem seu lucro</span>
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-base font-semibold leading-8 text-[#6b7280]">
            Eles resolvem parte da operação, mas cobram caro por isso. O PratoBy
            existe para sua loja vender pelo próprio link, com sua marca e sem comissão do PratoBy por pedido.
          </p>
        </motion.div>

        {/* Grid de Problemas (Cards centralizados) */}
        <div className="grid gap-5 sm:grid-cols-3 lg:gap-6">
          {problems.map((problem, index) => {
            const Icon = problem.icon

            return (
              <motion.article
                key={problem.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.45, delay: index * 0.08 }}
                // Adicionado: flex flex-col items-center text-center para alinhar tudo ao meio
                className="group flex flex-col items-center text-center rounded-[2rem] border border-white bg-white/90 p-6 shadow-sm ring-1 ring-red-100/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-100/70"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 ring-1 ring-red-100 transition group-hover:bg-red-600 group-hover:text-white">
                  <Icon size={23} />
                </div>

                <p className="mt-5 text-4xl font-black tracking-tight text-red-600">
                  {problem.value}
                </p>

                <h3 className="mt-2 text-base font-black text-[#111827]">
                  {problem.label}
                </h3>

                <p className="mt-3 text-sm font-semibold leading-7 text-[#6b7280]">
                  {problem.description}
                </p>
              </motion.article>
            )
          })}
        </div>

        {/* Call to Action Inferior */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25 }}
          className="mx-auto mt-8 max-w-3xl flex flex-col items-center rounded-[2rem] border border-orange-100 bg-white/90 p-5 text-center shadow-xl shadow-orange-100/40"
        >
          <p className="text-base font-black text-[#111827] sm:text-lg">
            Chega de depender de uma vitrine que cobra de cada venda.
          </p>

          <p className="mt-2 text-sm font-semibold leading-6 text-[#6b7280]">
            Com o PratoBy, você divulga seu próprio link, recebe pedidos no painel e mantém o cliente na sua marca.
          </p>
        </motion.div>
      </div>
    </section>
  )
}
