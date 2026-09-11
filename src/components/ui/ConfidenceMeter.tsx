import { bandColorClass } from '../../utils/format'
import type { ConfidenceBand } from '../../types/domain'

export function ConfidenceMeter({ value, band }: { value: number; band: ConfidenceBand }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-200">
        <div className={cn('h-full rounded-full', bandColorClass(band))} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs font-medium text-slate-600">{value}%</span>
    </div>
  )
}

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}
