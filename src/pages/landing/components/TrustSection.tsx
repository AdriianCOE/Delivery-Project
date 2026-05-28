import { motion } from 'motion/react';
import { Shield, Lock, TrendingUp, CheckCircle } from 'lucide-react';

const trustFeatures = [
  {
    icon: Lock,
    title: 'Transações seguras',
    description: 'Pix, dinheiro e maquininha',
  },
  {
    icon: TrendingUp,
    title: 'Uptime 99.9%',
    description: 'Sempre no ar',
  },
  {
    icon: Shield,
    title: 'LGPD',
    description: 'Dados protegidos',
  },
  {
    icon: CheckCircle,
    title: 'Monitoramento 24h',
    description: 'Ambiente seguro',
  },
];

export function TrustSection() {
  return (
    <section className="py-12 lg:py-16 bg-white border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Title */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center lg:text-left"
          >
            <div className="inline-flex items-center gap-2 bg-green-50 rounded-full px-4 py-2 mb-3">
              <Shield className="text-green-600" size={16} />
              <span className="text-sm font-semibold text-green-900">Segurança garantida</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-black text-gray-900">
              Tecnologia profissional
            </h2>
          </motion.div>

          {/* Features - Minimal */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8"
          >
            {trustFeatures.map((feature, index) => (
              <div key={feature.title} className="text-center">
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center mb-2 mx-auto">
                  <feature.icon className="text-green-600" size={20} />
                </div>
                <div className="text-sm font-bold text-gray-900">{feature.title}</div>
                <div className="text-xs text-gray-500 mt-0.5">{feature.description}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
