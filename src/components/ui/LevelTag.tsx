import type { ActivityLevel } from '../../types/domain'
import { cn } from '../../utils/cn'

const LEVEL_COLORS: Record<ActivityLevel, string> = {
  L1: 'bg-slate-800 text-white',
  L2: 'bg-slate-700 text-white',
  L3: 'bg-slate-600 text-white',
  L4: 'bg-slate-500 text-white',
  L5: 'bg-slate-400 text-white',
  L6: 'bg-slate-300 text-slate-800',
}

export function LevelTag({ level, className }: { level: ActivityLevel; className?: string }) {
  return (
    <span className={cn('inline-flex h-5 min-w-[2rem] items-center justify-center rounded px-1.5 text-[10px] font-bold uppercase', LEVEL_COLORS[level], className)}>
      {level}
    </span>
  )
}
