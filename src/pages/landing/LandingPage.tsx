import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import SEO from '../../components/seo/SEO'
import {
  MARKETING_SEO,
  buildFaqPageJsonLd,
  buildMarketingJsonLd,
} from '../../components/seo/seoConfig'
import MarketingLayout from '../MarketingLayout'

import { HeroSection } from './components/HeroSection'
import { landingFaqs } from './components/faqData'

const PainSection = lazy(() => import('./components/PainSection').then((module) => ({ default: module.PainSection })))
const SolutionSection = lazy(() => import('./components/SolutionSection').then((module) => ({ default: module.SolutionSection })))
const ProductDemoSection = lazy(() => import('./components/ProductDemoSection').then((module) => ({ default: module.ProductDemoSection })))
const TrustSection = lazy(() => import('./components/TrustSection').then((module) => ({ default: module.TrustSection })))
const ComparisonSection = lazy(() => import('./components/ComparisonSection').then((module) => ({ default: module.ComparisonSection })))
const PricingSection = lazy(() => import('./components/PricingSection').then((module) => ({ default: module.PricingSection })))
const FAQSection = lazy(() => import('./components/FAQSection').then((module) => ({ default: module.FAQSection })))
const FinalCTASection = lazy(() => import('./components/FinalCTASection').then((module) => ({ default: module.FinalCTASection })))

function useDeferredLandingSections() {
  const [ready, setReady] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || ready) return undefined

    const loadSections = () => {
      setReady(true)
    }

    const node = sentinelRef.current

    if (!node || !('IntersectionObserver' in window)) {
      const timeoutId = window.setTimeout(loadSections, 3000)
      return () => window.clearTimeout(timeoutId)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadSections()
          observer.disconnect()
        }
      },
      { rootMargin: '120px 0px' }
    )

    observer.observe(node)

    return () => observer.disconnect()
  }, [ready])

  return { ready, sentinelRef }
}

function LandingDeferredSections() {
  const { ready, sentinelRef } = useDeferredLandingSections()
  const fallback = (
    <div ref={sentinelRef} className="h-12 bg-white" aria-hidden="true" />
  )

  if (!ready) return fallback

  return (
    <Suspense fallback={fallback}>
      <PainSection />
      <SolutionSection />
      <ProductDemoSection />
      <TrustSection />
      <ComparisonSection />
      <PricingSection />
      <FAQSection />
      <FinalCTASection />
    </Suspense>
  )
}

export default function LandingPage() {
  const homeJsonLd = [
    buildMarketingJsonLd(),
    buildFaqPageJsonLd(landingFaqs),
  ].filter(Boolean)

  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'

    return () => {
      document.documentElement.style.removeProperty('color-scheme')
    }
  }, [])

  return (
    <MarketingLayout>
      <SEO
        {...MARKETING_SEO.home}
        structuredData={homeJsonLd}
      />

      <div className="bg-white text-gray-900">
        <HeroSection />
        <LandingDeferredSections />
      </div>
    </MarketingLayout>
  )
}
