import { useTranslation } from 'react-i18next'
import type { AuditEvent } from '../../types/domain'
import { getUser } from '../../services/api'
import { Avatar } from '../ui/Avatar'
import { TimeAgo } from '../ui/TimeAgo'

const ACTION_CATEGORIES: Partial<Record<AuditEvent['action'], string>> = {
  PROJECT_CREATED: 'setup',
  SCHEDULE_UPLOADED: 'setup',
  WORK_ASSIGNED: 'setup',
  REPORT_SUBMITTED: 'reports',
  AI_PROCESSED: 'reports',
  AI_AUTO_APPROVED: 'reports',
  AI_REVIEW_ACCEPTED: 'decisions',
  AI_CORRECTED: 'decisions',
  AI_LINKED: 'decisions',
  AI_ASKED: 'communication',
  QUESTION_ASKED: 'communication',
  REPLY_SENT: 'communication',
  THREAD_RESOLVED: 'communication',
  DELAY_REPORTED: 'delays',
  LOGIN: 'setup',
}

const ACTION_COLORS: Record<string, string> = {
  setup: 'bg-slate-100 text-slate-700',
  reports: 'bg-violet-100 text-violet-700',
  decisions: 'bg-emerald-100 text-emerald-700',
  communication: 'bg-amber-100 text-amber-700',
  delays: 'bg-rose-100 text-rose-700',
}

export function AuditRow({ event }: { event: AuditEvent }) {
  const { t } = useTranslation()
  const actor = getUser(event.actorId)
  const category = ACTION_CATEGORIES[event.action] ?? 'setup'
  return (
    <div className="flex items-start gap-3 py-2">
      <Avatar initials={actor?.avatarInitials ?? '?'} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-800">{actor?.name ?? event.actorId}</span>
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${ACTION_COLORS[category]}`}>{t(`auditActions.${event.action}`, event.descriptionParams)}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-mono">{event.entityType}</span>
          <span className="font-mono text-slate-400">{event.entityId}</span>
          <span>·</span>
          <TimeAgo iso={event.timestamp} />
        </div>
      </div>
    </div>
  )
}
