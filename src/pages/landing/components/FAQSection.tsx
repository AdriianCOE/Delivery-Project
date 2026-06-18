import { motion } from 'motion/react'
import { useState } from 'react'
import { FiChevronDown as ChevronDown } from 'react-icons/fi'
import { landingFaqs } from './faqData'

export { landingFaqs }

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="duvidas" className="bg-[#f8fafc] py-16 lg:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 text-center lg:mb-16"
        >
          <h2 className="mb-4 text-3xl font-black text-gray-900 lg:text-4xl">
            Perguntas frequentes
          </h2>
          <p className="text-lg text-gray-600">
            Tire suas dúvidas sobre o PratoBy e como funciona.
          </p>
        </motion.div>

        <div className="space-y-4">
          {landingFaqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.05 }}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-gray-300"
            >
              <button
                type="button"
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="flex w-full items-center justify-between px-6 py-5 text-left"
              >
                <span className="pr-4 font-semibold text-gray-900">{faq.question}</span>
                <ChevronDown
                  className={`shrink-0 text-gray-400 transition-transform ${
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
  )
}
