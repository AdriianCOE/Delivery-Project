import React from 'react'

export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-zinc-800 ${className}`} />
  )
}

export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`animate-pulse rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-850 dark:bg-zinc-900 ${className}`}>
      {children || (
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-1/3" />
          <SkeletonBlock className="h-8 w-2/3" />
          <SkeletonBlock className="h-3 w-1/2" />
        </div>
      )}
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header Skeleton */}
      <div className="flex animate-pulse items-center gap-4 border-b border-gray-100 pb-5 dark:border-zinc-800">
        <div className="h-10 w-10 rounded-2xl bg-gray-200 dark:bg-zinc-800" />
        <div className="flex-1 space-y-2">
          <div className="h-6 w-48 rounded bg-gray-200 dark:bg-zinc-800" />
          <div className="h-4 w-72 rounded bg-gray-200 dark:bg-zinc-800" />
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Main Section Skeletons */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <SkeletonCard className="h-64" />
          <SkeletonCard className="h-64" />
        </div>
        <div className="space-y-4">
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
          <SkeletonCard className="h-40" />
        </div>
      </div>
    </div>
  )
}
