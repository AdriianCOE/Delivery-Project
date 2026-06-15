import { motion } from 'motion/react';
import { useState } from 'react';
import { FiChevronDown as ChevronDown } from 'react-icons/fi';

const faqs = [
  {
    question: 'Preciso pagar comissão por pedido?',
    answer:
      'Não! No PratoBy você não paga nenhuma taxa por pedido. Você paga apenas a mensalidade do plano escolhido e 100% do valor dos pedidos é seu.',
  },
  {
    question: 'Preciso de cartão de crédito para começar?',
    answer: 'Sim. Você informa o cartão para ativar o teste, mas não paga nada durante os 14 dias grátis. A cobrança só acontece depois do período de teste, caso você continue com o plano.',
  },
  {
    question: 'O cliente precisa baixar aplicativo?',
    answer:
      'Não. Seu cliente acessa a loja direto pelo navegador do celular, sem precisar instalar nada. Ele clica no link e já pode fazer o pedido.',
  },
  {
    question: 'Posso usar Pix e maquininha?',
    answer:
      'Sim! Você configura os métodos de pagamento que aceita: dinheiro, Pix, cartão na maquininha, ou até integração com gateway de pagamento online.',
  },
  {
    question: 'Funciona pelo WhatsApp?',
    answer:
      'Sim! Você pode compartilhar o link da sua loja pelo WhatsApp, Instagram, bio ou qualquer outro lugar. Seu cliente clica e faz o pedido.',
  },
  {
    question: 'Consigo fechar a loja quando quiser?',
    answer:
      'Sim. Você configura os horários de funcionamento e pode abrir ou fechar manualmente a qualquer momento pelo painel de controle.',
  },
  {
    question: 'Posso editar produtos e preços sozinho?',
    answer:
      'Sim! Você tem controle total. Pode adicionar, editar ou remover produtos, mudar preços, criar categorias e fazer promoções quando quiser.',
  },
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="duvidas" className="bg-[#f8fafc] py-16 lg:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4">
            Perguntas frequentes
          </h2>
          <p className="text-lg text-gray-600">
            Tire suas dúvidas sobre o PratoBy e como funciona.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
            >
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full px-6 py-5 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 pr-4">{faq.question}</span>
                <ChevronDown
                  className={`flex-shrink-0 text-gray-400 transition-transform ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  size={20}
                />
              </button>
              {openIndex === index && (
                <div className="px-6 pb-5">
                  <p className="text-gray-600">{faq.answer}</p>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
