import { useTranslation } from 'react-i18next'
import type { AiDecision } from '../../types/domain'
import { Chip } from './Chip'

export function DecisionChip({ decision, className }: { decision: AiDecision; className?: string }) {
  const { t } = useTranslation()
  const color: Record<AiDecision, string> = {
    AUTO_APPROVED: 'emerald',
    ACCEPTED: 'emerald',
    CORRECTED: 'blue',
    LINKED: 'violet',
    PENDING: 'amber',
    ASKED: 'orange',
  }
  return (
    <Chip color={color[decision]} className={className}>
      {t(`decision.${decision}`)}
    </Chip>
  )
}
