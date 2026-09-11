import { Icon } from './Icon'

export function SimulatedAiTag({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700 ${className ?? ''}`}>
      <Icon name="reconciliation" size={10} />
      Simulated AI
    </span>
  )
}
