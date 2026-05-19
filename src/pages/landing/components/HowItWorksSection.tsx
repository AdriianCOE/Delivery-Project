import { motion } from 'motion/react';
import { Store, Package, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom'

const steps = [
  {
    number: '01',
    icon: Store,
    title: 'Cadastre sua loja',
    description: 'Crie sua conta, adicione nome, logo e informações básicas em minutos.',
  },
  {
    number: '02',
    icon: Package,
    title: 'Adicione produtos e categorias',
    description: 'Monte seu cardápio com fotos, preços, adicionais e descrições.',
  },
  {
    number: '03',
    icon: Share2,
    title: 'Compartilhe o link e receba pedidos',
    description: 'Envie seu link personalizado e comece a receber pedidos em tempo real.',
  },
];

export function HowItWorksSection() {
  return (
    <section id="como-funciona" className="relative overflow-hidden bg-white py-16 lg:py-24">
      <div className="pointer-events-none absolute left-1/2 top-0 h-px w-full max-w-6xl -translate-x-1/2 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4">
            Como funciona na prática
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Em 3 passos simples você já está vendendo com seu próprio delivery.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.2 }}
              className="relative"
            >
              {/* Connector line - desktop only */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-16 left-[60%] w-full h-0.5 bg-gradient-to-r from-orange-200 to-transparent" />
              )}

              <div className="relative bg-white border border-gray-200 rounded-xl p-8 text-center hover:border-orange-200 transition-all hover:shadow-sm">
                {/* Step number */}
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-12 h-12 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg">
                  {index + 1}
                </div>

                {/* Icon */}
                <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-4 mt-4">
                  <step.icon className="text-orange-500" size={28} />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                <p className="text-gray-600">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="text-center mt-12"
        >
          <Link to="/contato" className="px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all hover:shadow-lg hover:shadow-orange-500/30">
            Começar agora
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
