import SEO from '../../components/seo/SEO'
import {
  MARKETING_SEO,
  buildFaqPageJsonLd,
  buildMarketingJsonLd,
} from '../../components/seo/seoConfig'
import MarketingLayout from '../MarketingLayout'

import { HeroSection } from './components/HeroSection'
import { PainSection } from './components/PainSection'
import { SolutionSection } from './components/SolutionSection'
import { ProductDemoSection } from './components/ProductDemoSection'
import { TrustSection } from './components/TrustSection'
import { ComparisonSection } from './components/ComparisonSection'
import { PricingSection } from './components/PricingSection'
import { FAQSection, landingFaqs } from './components/FAQSection'
import { FinalCTASection } from './components/FinalCTASection'

export default function LandingPage() {
  const homeJsonLd = [
    buildMarketingJsonLd(),
    buildFaqPageJsonLd(landingFaqs),
  ].filter(Boolean)

  return (
    <MarketingLayout>
      <SEO
        {...MARKETING_SEO.home}
        structuredData={homeJsonLd}
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

