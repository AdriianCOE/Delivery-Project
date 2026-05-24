import React from 'react'
import { formatBillingStatus, getBillingStatusTone } from '../../utils/billingStatus'

export default function SubscriptionStatusBadge({ status }) {
  const label = formatBillingStatus(status)
  const tone = getBillingStatusTone(status)

  const tones = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/25',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-500/10 dark:text-indigo-400 dark:ring-indigo-500/25',
    orange: 'bg-orange-50 text-[#f97316] ring-orange-600/10 dark:bg-orange-500/10 dark:text-[#f97316] dark:ring-orange-500/25',
    red: 'bg-red-50 text-red-700 ring-red-600/10 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/25',
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wide ring-1 ring-inset ${tones[tone] || tones.orange}`}>
      {label}
    </span>
  )
}
