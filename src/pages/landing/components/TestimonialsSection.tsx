import { motion } from 'motion/react';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Carlos Mendes',
    business: 'Pizzaria do Bairro',
    image: 'CM',
    rating: 5,
    text: 'Organizamos os pedidos e paramos de perder venda no WhatsApp. O painel em tempo real mudou nossa operação.',
  },
  {
    name: 'Ana Paula',
    business: 'Burger Premium',
    image: 'AP',
    rating: 5,
    text: 'O cardápio ficou com aparência profissional. Meus clientes comentam que parece app de delivery grande.',
  },
  {
    name: 'Rodrigo Silva',
    business: 'Açaí da Praia',
    image: 'RS',
    rating: 5,
    text: 'Agora mando o link da loja direto no Instagram. Cliente clica e já faz o pedido sem complicação.',
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 lg:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 lg:mb-16"
        >
          <h2 className="text-3xl lg:text-4xl font-black text-gray-900 mb-4">
            Lojistas já estão vendendo com o PratoBy
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Veja o que donos de restaurantes falam sobre a experiência.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white border border-gray-200 rounded-xl p-6 hover:border-gray-300 transition-all hover:shadow-sm"
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="text-orange-500 fill-orange-500" size={16} />
                ))}
              </div>

              {/* Text */}
              <p className="text-gray-700 mb-6">"{testimonial.text}"</p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                  <span className="font-bold text-orange-700">{testimonial.image}</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.business}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
