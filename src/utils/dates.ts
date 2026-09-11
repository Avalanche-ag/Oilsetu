import { APP_CONFIG } from '../config/constants'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function nowDate(): Date {
  return new Date()
}

export function todayIso(): string {
  const d = nowDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function isoOffset(days: number): string {
  const d = nowDate()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysAgoIso(days: number): string {
  return isoOffset(-days)
}

export function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / MS_PER_DAY)
}

export function localeFor(lang: string): string {
  return lang === 'hi' ? 'hi-IN' : 'en-IN'
}

export function fmtDate(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parseIso(iso))
}

export function fmtDateTime(iso: string, lang: string): string {
  const d = new Date(iso)
  return new Intl.DateTimeFormat(localeFor(lang), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export function timeAgo(iso: string | undefined, lang: string): string {
  if (!iso) return ''
  const now = nowDate().getTime()
  const then = new Date(iso).getTime()
  const diffSec = Math.max(0, Math.floor((now - then) / 1000))

  const rtf = new Intl.RelativeTimeFormat(localeFor(lang), { numeric: 'auto' })

  if (diffSec < 60) return rtf.format(0, 'second')
  if (diffSec < 3600) return rtf.format(-Math.floor(diffSec / 60), 'minute')
  if (diffSec < 86400) return rtf.format(-Math.floor(diffSec / 3600), 'hour')
  if (diffSec < 2592000) return rtf.format(-Math.floor(diffSec / 86400), 'day')
  if (diffSec < 31536000) return rtf.format(-Math.floor(diffSec / 2592000), 'month')
  return rtf.format(-Math.floor(diffSec / 31536000), 'year')
}

export function monthLabel(iso: string, lang: string): string {
  return new Intl.DateTimeFormat(localeFor(lang), { month: 'short', year: '2-digit' }).format(parseIso(iso))
}

export function startOfMonth(iso: string): string {
  const d = parseIso(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function isPastOrToday(iso: string): boolean {
  return parseIso(iso).getTime() <= nowDate().setHours(0, 0, 0, 0)
}

export { APP_CONFIG }
