import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'

import SEO from '../../components/seo/SEO'
import {
  MARKETING_SEO,
  buildFaqPageJsonLd,
  buildMarketingJsonLd,
} from '../../components/seo/seoConfig'
import MarketingLayout from '../MarketingLayout'

import { HeroSection } from './components/HeroSection'
import { landingFaqs } from './components/faqData'

const PainSection = lazy(() =>
  import('./components/PainSection').then((module) => ({
    default: module.PainSection,
  }))
)

const SolutionSection = lazy(() =>
  import('./components/SolutionSection').then((module) => ({
    default: module.SolutionSection,
  }))
)

const ProductDemoSection = lazy(() =>
  import('./components/ProductDemoSection').then((module) => ({
    default: module.ProductDemoSection,
  }))
)

const TrustSection = lazy(() =>
  import('./components/TrustSection').then((module) => ({
    default: module.TrustSection,
  }))
)

const ComparisonSection = lazy(() =>
  import('./components/ComparisonSection').then((module) => ({
    default: module.ComparisonSection,
  }))
)

const PricingSection = lazy(() =>
  import('./components/PricingSection').then((module) => ({
    default: module.PricingSection,
  }))
)

const FAQSection = lazy(() =>
  import('./components/FAQSection').then((module) => ({
    default: module.FAQSection,
  }))
)

const FinalCTASection = lazy(() =>
  import('./components/FinalCTASection').then((module) => ({
    default: module.FinalCTASection,
  }))
)

const SocialWaveSection = lazy(() =>
  import('./components/SocialWaveSection').then((module) => ({
    default: module.SocialWaveSection,
  }))
)

const DEFERRED_SECTIONS_TIMEOUT_MS = 2400
const DEFERRED_SECTIONS_ROOT_MARGIN = '420px 0px'

function LandingSectionsSkeleton({
  sentinelRef,
}: {
  sentinelRef?: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div
      ref={sentinelRef}
      className="relative overflow-hidden bg-white"
      aria-hidden="true"
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-2 w-32 rounded-full bg-orange-100" />
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="h-28 rounded-[1.5rem] bg-orange-50/80" />
          <div className="h-28 rounded-[1.5rem] bg-slate-50" />
          <div className="h-28 rounded-[1.5rem] bg-orange-50/60" />
        </div>
      </div>
    </div>
  )
}

function useDeferredLandingSections() {
  const [ready, setReady] = useState(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || ready) return undefined

    let timeoutId: number | undefined
    let idleId: number | undefined
    let observer: IntersectionObserver | undefined

    const loadSections = () => {
      setReady(true)
    }

    const scheduleFallbackLoad = () => {
      timeoutId = window.setTimeout(loadSections, DEFERRED_SECTIONS_TIMEOUT_MS)

      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(
          () => {
            loadSections()
          },
          { timeout: DEFERRED_SECTIONS_TIMEOUT_MS }
        )
      }
    }

    const node = sentinelRef.current

    if (!node || !('IntersectionObserver' in window)) {
      scheduleFallbackLoad()

      return () => {
        if (timeoutId) window.clearTimeout(timeoutId)
        if (idleId && 'cancelIdleCallback' in window) {
          window.cancelIdleCallback(idleId)
        }
      }
    }

    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadSections()
          observer?.disconnect()
        }
      },
      {
        rootMargin: DEFERRED_SECTIONS_ROOT_MARGIN,
        threshold: 0.01,
      }
    )

    observer.observe(node)
    scheduleFallbackLoad()

    return () => {
      observer?.disconnect()

      if (timeoutId) window.clearTimeout(timeoutId)
      if (idleId && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
    }
  }, [ready])

  return { ready, sentinelRef }
}

function LandingDeferredSections() {
  const { ready, sentinelRef } = useDeferredLandingSections()

  const fallback = <LandingSectionsSkeleton sentinelRef={sentinelRef} />

  if (!ready) return fallback

  return (
    <Suspense fallback={<LandingSectionsSkeleton />}>
      <PainSection />
      <SolutionSection />
      <ProductDemoSection />
      <TrustSection />
      <ComparisonSection />
      <PricingSection />
      <FAQSection />
      <SocialWaveSection />
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

    const targets = [document.documentElement, document.body]
    targets.forEach((target) => {
      target.classList.add('pratoby-scrollbar', 'pratoby-page-scrollbar')
    })

    return () => {
      document.documentElement.style.removeProperty('color-scheme')
      targets.forEach((target) => {
        target.classList.remove('pratoby-scrollbar', 'pratoby-page-scrollbar')
      })
    }
  }, [])

  return (
    <MarketingLayout>
      <SEO {...MARKETING_SEO.home} structuredData={homeJsonLd} />

      <main className="bg-white text-gray-900">
        <HeroSection />
        <LandingDeferredSections />
      </main>
    </MarketingLayout>
  )
}