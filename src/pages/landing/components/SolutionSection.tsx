import { motion } from 'motion/react';
import { Menu, ShoppingCart, BarChart3, Link as LinkIcon, Tag, Star } from 'lucide-react';

const solutions = [
  {
    icon: Menu,
    title: 'Cardápio digital profissional',
    description: 'Bonito, organizado por categorias e fácil de atualizar quando quiser.',
  },
  {
    icon: ShoppingCart,
    title: 'Carrinho completo',
    description: 'Com adicionais, observações e cálculo automático de entrega.',
  },
  {
    icon: BarChart3,
    title: 'Painel de pedidos em tempo real',
    description: 'Veja todos os pedidos, confirme, aceite e acompanhe o status.',
  },
  {
    icon: LinkIcon,
    title: 'Link próprio da loja',
    description: 'Compartilhe no Instagram, WhatsApp e bio. Seus clientes acessam direto.',
  },
  {
    icon: Tag,
    title: 'Cupons e taxas por bairro',
    description: 'Crie promoções e configure entrega personalizada por região.',
  },
  {
    icon: Star,
    title: 'Acompanhamento do pedido',
    description: 'Cliente vê status em tempo real: confirmado, em preparo, saiu para entrega.',
  },
];

export function SolutionSection() {
  return (
    <section id="recursos" className="relative overflow-hidden bg-[#f8fafc] py-16 lg:py-24">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-orange-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-10 h-72 w-72 rounded-full bg-slate-200/60 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 lg:mb-16"
          >
            <div className="inline-flex items-center gap-2 bg-white border border-orange-100 rounded-full px-5 py-2.5 mb-6 shadow-sm">
              <div className="w-2.5 h-2.5 bg-[#f97316] rounded-full animate-pulse" />
              <span className="text-sm font-black uppercase tracking-wide text-[#f97316]">
                A solução completa
              </span>
            </div>
            <h2 className="text-3xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
              O PratoBy <span className="text-[#f97316]">organiza sua operação</span>
              <br />
              em poucos minutos.
            </h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Tudo que você precisa para vender mais, sem depender de apps com taxa alta.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {solutions.map((solution, index) => (
              <motion.div
                key={solution.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-sm ring-1 ring-slate-100 transition-all duration-300 hover:-translate-y-1 hover:border-orange-100 hover:shadow-2xl hover:shadow-orange-100/50"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#f97316] transition-colors group-hover:bg-[#f97316] group-hover:text-white">
                  <solution.icon size={24} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{solution.title}</h3>
                <p className="text-gray-600">{solution.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
    </section>
  );
}
