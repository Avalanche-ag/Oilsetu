import { cn } from '../../utils/cn'

export function Chip({ children, color = 'slate', className }: { children: React.ReactNode; color?: string; className?: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    cyan: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  }
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide', colorMap[color] ?? colorMap.slate, className)}>
      {children}
    </span>
  )
}
