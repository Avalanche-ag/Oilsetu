import { useTranslation } from 'react-i18next'
import type { Discipline } from '../../types/domain'
import { cn } from '../../utils/cn'

const STYLE: Record<string, { dot: string; chip: string }> = {
  CIVIL: { dot: 'bg-amber-600', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
  PIPING: { dot: 'bg-sky-600', chip: 'bg-sky-50 text-sky-800 border-sky-200' },
  ELECTRICAL: { dot: 'bg-yellow-500', chip: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
  INSTRUMENTATION: { dot: 'bg-violet-600', chip: 'bg-violet-50 text-violet-800 border-violet-200' },
  EQUIPMENT: { dot: 'bg-orange-600', chip: 'bg-orange-50 text-orange-800 border-orange-200' },
  HSE: { dot: 'bg-emerald-600', chip: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
}

export function DisciplineChip({ discipline, className }: { discipline: Discipline | null; className?: string }) {
  const { t } = useTranslation()
  const style = discipline ? STYLE[discipline] : { dot: 'bg-slate-400', chip: 'bg-slate-50 text-slate-700 border-slate-200' }
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium', style.chip, className)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
      {discipline ? t(`discipline.${discipline}`) : '—'}
    </span>
  )
}

export function DisciplineDot({ discipline, className }: { discipline: Discipline | null; className?: string }) {
  const style = discipline ? STYLE[discipline] : { dot: 'bg-slate-400' }
  return <span className={cn('h-2 w-2 rounded-full', style.dot, className)} />
}
