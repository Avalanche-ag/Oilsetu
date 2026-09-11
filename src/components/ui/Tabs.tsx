import { cn } from '../../utils/cn'

interface TabsProps<T extends string> {
  tabs: { key: T; label: React.ReactNode; badge?: number }[]
  active: T
  onChange: (key: T) => void
}

export function Tabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="flex border-b border-slate-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
            active === tab.key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          {tab.label}
          {typeof tab.badge === 'number' && tab.badge > 0 && (
            <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-bold text-amber-700">
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

export function SegmentedTabs<T extends string>({ tabs, active, onChange }: TabsProps<T>) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            active === tab.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
