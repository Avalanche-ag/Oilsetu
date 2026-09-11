import { useTranslation } from 'react-i18next'
import { timeAgo } from '../../utils/dates'

export function TimeAgo({ iso, className }: { iso: string | undefined; className?: string }) {
  const { i18n } = useTranslation()
  if (!iso) return null
  return <span className={className}>{timeAgo(iso, i18n.language)}</span>
}
