import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAudit, getUsers } from '../../services/api'
import { PageHeader, Card, CardBody, Select } from '../../components/ui'
import { AuditRow } from '../../components/shared/AuditRow'
import type { AuditEvent } from '../../types/domain'

const FILTER_GROUPS: { key: string; actions: AuditEvent['action'][] }[] = [
  { key: 'filterSetup', actions: ['PROJECT_CREATED', 'SCHEDULE_UPLOADED', 'WORK_ASSIGNED', 'LOGIN'] },
  { key: 'filterReports', actions: ['REPORT_SUBMITTED', 'AI_PROCESSED', 'AI_AUTO_APPROVED'] },
  { key: 'filterDecisions', actions: ['AI_REVIEW_ACCEPTED', 'AI_CORRECTED', 'AI_LINKED'] },
  { key: 'filterCommunication', actions: ['AI_ASKED', 'QUESTION_ASKED', 'REPLY_SENT', 'THREAD_RESOLVED'] },
  { key: 'filterDelays', actions: ['DELAY_REPORTED'] },
]

export function AuditPage() {
  const { t } = useTranslation()
  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const { data: events = [] } = useQuery({ queryKey: ['audit'], queryFn: () => getAudit() })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const filtered = useMemo(() => {
    return events.filter((e) => {
      if (actorFilter && e.actorId !== actorFilter) return false
      if (actionFilter) {
        const group = FILTER_GROUPS.find((g) => g.key === actionFilter)
        if (group && !group.actions.includes(e.action)) return false
      }
      return true
    })
  }, [events, actorFilter, actionFilter])

  return (
    <div>
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />
      <Card>
        <div className="flex flex-wrap gap-2 border-b border-slate-100 p-3">
          <Select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)} className="w-full sm:w-44">
            <option value="">{t('audit.allActors')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </Select>
          <Select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="w-full sm:w-44">
            <option value="">{t('audit.allActions')}</option>
            {FILTER_GROUPS.map((g) => (
              <option key={g.key} value={g.key}>{t(`audit.${g.key}`)}</option>
            ))}
          </Select>
        </div>
        <CardBody className="divide-y divide-slate-100">
          {filtered.map((event) => (
            <AuditRow key={event.id} event={event} />
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
