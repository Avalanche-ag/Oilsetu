import { cn } from '../../utils/cn'

export function ProgressBar({ value, className, barClassName }: { value: number; className?: string; barClassName?: string }) {
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div className={cn('h-full rounded-full transition-all', barClassName ?? 'bg-brand-600')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  )
}
