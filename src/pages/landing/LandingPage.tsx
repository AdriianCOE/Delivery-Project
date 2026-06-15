import SEO from '../../components/seo/SEO'
import MarketingLayout from '../MarketingLayout'

import { HeroSection } from './components/HeroSection'
import { PainSection } from './components/PainSection'
import { SolutionSection } from './components/SolutionSection'
import { ProductDemoSection } from './components/ProductDemoSection'
import { TrustSection } from './components/TrustSection'
import { ComparisonSection } from './components/ComparisonSection'
import { PricingSection } from './components/PricingSection'
import { FAQSection } from './components/FAQSection'
import { FinalCTASection } from './components/FinalCTASection'

export default function LandingPage() {
  return (
    <MarketingLayout>
      <SEO
        title="PratoBy | Cardápio digital e delivery"
        description="Crie seu cardápio digital, receba pedidos online e organize entrega, retirada, pagamentos e encomendas em um painel simples — sem comissão do PratoBy por pedido."
        path="/"
      />

      <div className="bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-50">
        <HeroSection />
        <PainSection />
        <SolutionSection />
        <ProductDemoSection />
        <TrustSection />
        <ComparisonSection />
        <PricingSection />
        <FAQSection />
        <FinalCTASection />
      </div>
    </MarketingLayout>
  )
}
