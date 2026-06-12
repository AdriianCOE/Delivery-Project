import { Link } from 'react-router-dom'
import { FiLock } from 'react-icons/fi'
import { getFeatureLabel, getPlanConfig, getRequiredPlanForFeature } from '../../utils/planCatalog'
import { getInsufficientPlanMessage } from '../../utils/planMessages'

export default function LockedFeatureCard({
  featureKey,
  featureName,
  requiredPlan,
  title,
  description,
  actionLabel = 'Fazer upgrade',
  actionTo = '/dashboard/billing',
  className = '',
}) {
  const requiredPlanId = requiredPlan || getRequiredPlanForFeature(featureKey)
  const resolvedFeatureName = featureName || getFeatureLabel(featureKey)
  const message = getInsufficientPlanMessage({
    featureKey,
    featureName: resolvedFeatureName,
    requiredPlan: requiredPlanId,
  })
  const planName = getPlanConfig(requiredPlanId).name

  return (
    <div className={`rounded-2xl border border-orange-100 bg-orange-50/80 p-4 text-orange-950 shadow-sm dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-100 ${className}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-[#f97316] shadow-sm dark:bg-zinc-950">
            <FiLock size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-black">{title || message.title}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-orange-900/80 dark:text-orange-100/80">
              {description || message.text}
            </p>
            {requiredPlanId ? (
              <p className="mt-2 text-[11px] font-black uppercase tracking-wide text-[#f97316]">
                Plano necessário: {planName}
              </p>
            ) : null}
          </div>
        </div>

        <Link
          to={actionTo}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-[#f97316] px-4 text-xs font-black text-white shadow-sm transition hover:bg-[#ea580c]"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  )
}
