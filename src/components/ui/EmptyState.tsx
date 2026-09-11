import { Icon, type IconName } from './Icon'

export function EmptyState({ icon, title, description }: { icon: IconName; title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
      <Icon name={icon} className="mb-3 text-slate-400" size={32} />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description && <p className="mt-1 max-w-xs text-xs text-slate-500">{description}</p>}
    </div>
  )
}
