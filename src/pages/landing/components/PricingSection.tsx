import { motion } from 'motion/react';
import { Check, Pizza, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

const plans = [
  {
    name: 'Essencial',
    description: 'Para começar a vender online',
    price: 'R$ 59',
    period: '/mês',
    features: [
      'Cardápio digital ilimitado',
      'Pedidos em tempo real',
      'Link próprio da loja',
      'Sem taxa por pedido',
      'Painel de controle',
      'Horários automáticos',
    ],
    cta: 'Começar agora',
    highlighted: false,
  },
  {
    name: 'Profissional',
    description: 'Mais escolhido pelos lojistas',
    price: 'R$ 89',
    period: '/mês',
    badge: 'Mais popular',
    features: [
      'Tudo do Essencial',
      'Cupons de desconto',
      'Taxa por bairro',
      'Campos personalizados',
      'Relatórios avançados',
      'WhatsApp integrado',
      'Suporte prioritário',
    ],
    cta: 'Começar agora',
    highlighted: true,
  },
  {
    name: 'Premium',
    description: 'Para quem quer vender mais',
    price: 'R$ 159',
    period: '/mês',
    features: [
      'Tudo do Profissional',
      'Multi-loja (até 3)',
      'API de integração',
      'Domínio personalizado',
      'Marca branca',
      'Gerente de conta dedicado',
    ],
    cta: 'Começar agora',
    highlighted: false,
  },
];

export function PricingSection() {
  const [hoveredPlan, setHoveredPlan] = useState<string | null>(null);

  return (
    <section id="planos" className="relative overflow-hidden bg-gradient-to-b from-white via-orange-50/30 to-white py-16 lg:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero pricing message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-orange-100 border-2 border-orange-300 rounded-full px-6 py-3 mb-6">
            <Sparkles className="text-orange-600" size={18} />
            <span className="text-sm font-bold text-orange-900">Sem pegadinha</span>
          </div>

          <h2 className="text-4xl lg:text-5xl font-black text-gray-900 mb-4 leading-tight">
            Quanto custa ter seu
            <br />
            <span className="text-orange-500">próprio delivery?</span>
          </h2>

          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Pizza className="text-orange-500" size={32} />
              <p className="text-2xl lg:text-3xl font-bold text-gray-900">
                Menos que 2 pizzas por mês.
              </p>
            </div>
            <p className="text-xl lg:text-2xl text-gray-600">
              E <span className="font-bold text-green-600">zero comissão</span>. Pra sempre.
            </p>
          </div>

          <div className="inline-block bg-white border-2 border-orange-200 rounded-2xl px-8 py-6 shadow-lg">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="text-center sm:text-left">
                <div className="text-sm text-gray-600 mb-1">Com apps tradicionais, você paga</div>
                <div className="text-3xl font-black text-red-600">R$ 30</div>
                <div className="text-xs text-gray-500">por pedido de R$ 100</div>
              </div>

              <div className="hidden sm:block w-px h-16 bg-gray-200" />

              <div className="text-center sm:text-left">
                <div className="text-sm text-gray-600 mb-1">Com o PratoBy, você paga</div>
                <div className="text-3xl font-black text-green-600">R$ 0</div>
                <div className="text-xs text-gray-500">por cada pedido</div>
              </div>
            </div>
          </div>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              onMouseEnter={() => setHoveredPlan(plan.name)}
              onMouseLeave={() => setHoveredPlan(null)}
              className={`relative bg-white rounded-[2rem] p-8 transition-all duration-300 ${
                plan.highlighted
                  ? 'border-2 border-orange-400 shadow-xl scale-105 lg:scale-110'
                  : 'border border-gray-200 hover:border-orange-200 hover:shadow-lg'
              } ${hoveredPlan === plan.name ? 'transform -translate-y-2' : ''}`}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg">
                    {plan.badge}
                  </div>
                </div>
              )}

              {/* Plan header */}
              <div className="text-center mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <p className="text-sm text-gray-600 mb-4">{plan.description}</p>
                <div className="flex items-baseline justify-center gap-1 mb-2">
                  <span className="text-5xl font-black text-gray-900">{plan.price}</span>
                  <span className="text-gray-600">{plan.period}</span>
                </div>
                <div className="text-sm text-green-600 font-semibold">
                  + 0% de comissão por venda
                </div>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check className="text-green-500 flex-shrink-0 mt-0.5" size={18} />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link
                to="/contato"
                className={`flex w-full items-center justify-center rounded-[1.4rem] py-3.5 font-bold transition-all ${
                  plan.highlighted
                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:scale-105 hover:shadow-xl hover:shadow-orange-500/40'
                    : 'border-2 border-gray-300 bg-white text-gray-900 hover:border-orange-400 hover:text-orange-600'
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Bottom note */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-center mt-12"
        >
          <p className="text-gray-600">
            Todos os planos incluem <span className="font-bold text-gray-900">período de teste gratuito</span> de 14 dias
          </p>
        </motion.div>
      </div>
    </section>
  );
}
