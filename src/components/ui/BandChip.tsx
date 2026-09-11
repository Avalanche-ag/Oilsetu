import { useTranslation } from 'react-i18next'
import type { ConfidenceBand } from '../../types/domain'
import { Chip } from './Chip'

export function BandChip({ band, className }: { band: ConfidenceBand; className?: string }) {
  const { t } = useTranslation()
  const color: Record<ConfidenceBand, string> = {
    AUTO: 'emerald',
    REVIEW: 'amber',
    UNMATCHED: 'rose',
  }
  return (
    <Chip color={color[band]} className={className}>
      {t(`band.${band}`)}
    </Chip>
  )
}
