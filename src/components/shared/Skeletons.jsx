

export function SkeletonBlock({ className = '' }) {
  return (
    <div className={`animate-pulse rounded-lg bg-gray-200 dark:bg-zinc-800 ${className}`} />
  )
}

export function SkeletonCard({ className = '', children }) {
  return (
    <div className={`animate-pulse rounded-[1.7rem] border border-gray-100 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
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

export function StorefrontSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#fff7ed] text-[#111827]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto min-h-screen w-full max-w-3xl bg-white shadow-sm">
        <div className="relative h-44 overflow-hidden bg-orange-100 sm:h-56">
          <SkeletonBlock className="absolute inset-0 h-full w-full rounded-none bg-orange-200/70" />
          <div className="absolute bottom-4 left-4 right-4 flex items-end gap-3">
            <SkeletonBlock className="h-20 w-20 rounded-3xl bg-white/80" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-6 w-48 bg-white/80" />
              <SkeletonBlock className="h-4 w-32 bg-white/70" />
            </div>
          </div>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div className="flex flex-wrap gap-2">
            <SkeletonBlock className="h-9 w-28 rounded-full" />
            <SkeletonBlock className="h-9 w-32 rounded-full" />
            <SkeletonBlock className="h-9 w-24 rounded-full" />
          </div>

          <SkeletonBlock className="h-12 w-full rounded-2xl" />

          <div className="flex gap-2 overflow-hidden">
            <SkeletonBlock className="h-10 w-24 shrink-0 rounded-full" />
            <SkeletonBlock className="h-10 w-32 shrink-0 rounded-full" />
            <SkeletonBlock className="h-10 w-28 shrink-0 rounded-full" />
          </div>

          <div className="grid gap-3">
            {[0, 1, 2, 3].map((item) => (
              <div
                key={item}
                className="grid grid-cols-[1fr_6rem] gap-3 rounded-3xl border border-orange-100 bg-white p-3 shadow-sm"
              >
                <div className="space-y-2 py-1">
                  <SkeletonBlock className="h-4 w-24" />
                  <SkeletonBlock className="h-5 w-44" />
                  <SkeletonBlock className="h-3 w-full" />
                  <SkeletonBlock className="h-3 w-2/3" />
                  <SkeletonBlock className="h-6 w-24 rounded-full" />
                </div>
                <SkeletonBlock className="aspect-square h-auto w-full rounded-2xl" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">Carregando cardapio.</span>
    </div>
  )
}

export function LandingFallback() {
  return (
    <div
      className="min-h-screen bg-white px-6 py-8 text-[#111827]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <SkeletonBlock className="h-9 w-32" />
        <SkeletonBlock className="h-9 w-24 rounded-full" />
      </div>
      <div className="mx-auto mt-16 max-w-3xl space-y-5">
        <SkeletonBlock className="h-12 w-11/12" />
        <SkeletonBlock className="h-12 w-8/12" />
        <SkeletonBlock className="h-5 w-full" />
        <SkeletonBlock className="h-5 w-9/12" />
        <SkeletonBlock className="h-12 w-40 rounded-full" />
      </div>
      <span className="sr-only">Carregando.</span>
    </div>
  )
}
