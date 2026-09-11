import { useTranslation } from 'react-i18next'
import type { ActivityStatus } from '../../types/domain'
import { Chip } from './Chip'

export function StatusChip({ status, className }: { status: ActivityStatus; className?: string }) {
  const { t } = useTranslation()
  const color: Record<ActivityStatus, string> = {
    NOT_STARTED: 'slate',
    IN_PROGRESS: 'blue',
    COMPLETED: 'emerald',
    DELAYED: 'rose',
    ON_HOLD: 'amber',
  }
  return (
    <Chip color={color[status]} className={className}>
      {t(`status.${status}`)}
    </Chip>
  )
}
