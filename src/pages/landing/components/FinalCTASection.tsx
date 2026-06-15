import { motion } from 'motion/react';
import { Link } from 'react-router-dom'
import { FiArrowRight as ArrowRight, FiMessageCircle as MessageCircle } from 'react-icons/fi';

export function FinalCTASection() {
  return (
    <section className="py-16 lg:py-24 bg-gradient-to-br from-orange-500 to-orange-600 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/5 rounded-full blur-3xl" />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 relative text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl lg:text-5xl font-black text-white mb-6">
            Pronto para vender pelo seu próprio delivery?
          </h2>
          <p className="text-lg lg:text-xl text-white/90 mb-10 max-w-2xl mx-auto">
            Crie sua loja, compartilhe seu link e comece a receber pedidos com uma experiência profissional.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/cadastro" className="px-8 py-4 bg-white text-orange-500 rounded-lg font-bold hover:bg-gray-50 transition-all hover:shadow-xl inline-flex items-center justify-center gap-2">
              Criar minha loja
              <ArrowRight size={20} />
            </Link>
            <Link to="/contato" className="px-8 py-4 bg-orange-600/50 backdrop-blur-sm text-white border-2 border-white/30 rounded-lg font-semibold hover:bg-orange-600/70 transition-all inline-flex items-center justify-center gap-2">
              <MessageCircle size={20} />
              Falar com o PratoBy
            </Link>
          </div>

          {/* Trust badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-white/80 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span>Sem taxa por pedido</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <span>Configuração em minutos</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
