export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ''}`} />
}

export function AiProcessingBlock() {
  return (
    <div className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        <span className="text-sm font-medium text-brand-800">Simulated AI analyzing report…</span>
        <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-brand-700">Mock</span>
      </div>
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-3/4" />
    </div>
  )
}
