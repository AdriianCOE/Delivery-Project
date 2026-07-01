import { Link } from 'react-router-dom'
import {
  FiArrowRight as ArrowRight,
  FiCheckCircle as CheckCircle,
  FiMessageCircle as MessageCircle,
} from 'react-icons/fi'

export function FinalCTASection() {
  return (
    <section className="relative isolate overflow-hidden bg-[#0f172a] py-20 text-white lg:py-28">
      <div
        aria-hidden="true"
        className="absolute -right-32 -top-40 h-[30rem] w-[30rem] rounded-full border-[5rem] border-orange-400/10"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-52 -left-36 h-[32rem] w-[32rem] rounded-full bg-orange-500/15 blur-3xl"
      />

      <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
        <p className="text-sm font-black uppercase tracking-[0.16em] text-orange-300">
          Seu próximo pedido pode vir pelo seu link
        </p>
        <h2 className="mx-auto mt-5 max-w-4xl text-3xl font-black leading-[1.03] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
          Venda direto. Fortaleça sua marca. Fique com a sua margem.
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-7 text-white/70 sm:text-lg">
          Crie sua loja, compartilhe seu cardápio e concentre os pedidos em uma operação simples.
        </p>

        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/cadastro"
            className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#f97316] px-8 text-base font-black text-white shadow-[0_18px_40px_rgba(249,115,22,.28)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ea580c] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          >
            Criar minha loja grátis
            <ArrowRight
              size={19}
              className="transition-transform group-hover:translate-x-1"
              aria-hidden="true"
            />
          </Link>
          <Link
            to="/contato"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.07] px-8 text-base font-black text-white transition duration-200 hover:-translate-y-0.5 hover:bg-white/[0.12] active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
          >
            <MessageCircle size={18} aria-hidden="true" />
            Falar com o PratoBy
          </Link>
        </div>

        <ul className="mt-9 flex flex-col items-center justify-center gap-3 text-sm font-bold text-white/70 sm:flex-row sm:gap-7">
          <li className="flex items-center gap-2">
            <CheckCircle size={16} className="text-orange-300" aria-hidden="true" />
            14 dias grátis
          </li>
          <li className="flex items-center gap-2">
            <CheckCircle size={16} className="text-orange-300" aria-hidden="true" />
            Zero comissão por pedido
          </li>
        </ul>
      </div>
    </section>
  )
}
