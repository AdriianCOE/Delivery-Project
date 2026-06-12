import { hasPlanFeature } from '../../utils/planCatalog'
import LockedFeatureCard from './LockedFeatureCard'

export default function PlanGate({
  storeData,
  featureKey,
  children,
  fallback,
  featureName,
  requiredPlan,
}) {
  if (hasPlanFeature(storeData || {}, featureKey)) return children

  if (fallback) return fallback

  return (
    <LockedFeatureCard
      featureKey={featureKey}
      featureName={featureName}
      requiredPlan={requiredPlan}
    />
  )
}
