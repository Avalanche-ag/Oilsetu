import type { ActivityStatus, ConfidenceBand } from '../types/domain'

export function toPct(n: number, digits = 0): string {
  return `${n.toFixed(digits)}%`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function statusRank(s: ActivityStatus): number {
  const map: Record<ActivityStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 1,
    DELAYED: 2,
    COMPLETED: 3,
    ON_HOLD: 4,
  }
  return map[s]
}

export function bandColorClass(band: ConfidenceBand): string {
  switch (band) {
    case 'AUTO':
      return 'bg-emerald-500'
    case 'REVIEW':
      return 'bg-amber-500'
    case 'UNMATCHED':
      return 'bg-rose-500'
  }
}
