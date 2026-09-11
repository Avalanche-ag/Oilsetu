import { cn } from '../../utils/cn'

export function Avatar({ initials, className, size = 'md' }: { initials: string; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  }
  return (
    <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700', sizes[size], className)}>
      {initials.slice(0, 2).toUpperCase()}
    </div>
  )
}
