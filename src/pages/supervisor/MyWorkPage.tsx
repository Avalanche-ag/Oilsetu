import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { getSupervisorWork, getAssignments, getActivity } from '../../services/api'
import { PageHeader, Card, CardBody, Input, StatusChip, ProgressBar, TimeAgo } from '../../components/ui'
import { ACTIVITY_STATUSES } from '../../config/constants'
import type { ActivityStatus, ScheduleActivity } from '../../types/domain'
import { fmtDate } from '../../utils/dates'

export function MyWorkPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<ActivityStatus | ''>('')
  const { data: work = [] } = useQuery({ queryKey: ['supWork', userId], queryFn: () => getSupervisorWork(userId || ''), enabled: Boolean(userId) })
  const { data: assignments = [] } = useQuery({ queryKey: ['assignments', activeProjectId], queryFn: () => getAssignments(activeProjectId || ''), enabled: Boolean(activeProjectId) })

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleActivity[]>()
    work.forEach((a) => {
      const assignment = assignments.find((asgn) => asgn.includedL6Ids.includes(a.id) && asgn.status === 'ACTIVE')
      const pkgId = assignment?.workPackageId ?? 'unassigned'
      const list = map.get(pkgId) ?? []
      list.push(a)
      map.set(pkgId, list)
    })
    return map
  }, [work, assignments])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    const entries = Array.from(grouped.entries())
    return entries.map(([pkgId, activities]) => ({
      pkgId,
      activities: activities.filter((a) => {
        const matchesSearch = !q || a.name.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
        const matchesStatus = !statusFilter || a.status === statusFilter
        return matchesSearch && matchesStatus
      }),
    })).filter((g) => g.activities.length > 0)
  }, [grouped, search, statusFilter])

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('sup.myWork.title')} />
      <div className="mb-3 flex gap-2">
        <Input placeholder={t('sup.myWork.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="flex-1" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ActivityStatus | '')}
          className="rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="">{t('explorer.allStatuses')}</option>
          {ACTIVITY_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      </div>

      {filtered.length === 0 && <div className="py-8 text-center text-sm text-slate-500">{t('sup.myWork.noWork')}</div>}

      <div className="space-y-4">
        {filtered.map((group) => {
          const pkg = activeProjectId ? getActivity(activeProjectId, group.pkgId) : undefined
          return (
          <Card key={group.pkgId}>
            <CardBody>
              <div className="mb-2 text-xs font-medium uppercase text-slate-500">{pkg ? pkg.name : group.pkgId}</div>
              <div className="space-y-2">
                {group.activities.map((a) => (
                  <div key={a.id} className="rounded border border-slate-100 p-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-800">{a.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{a.id}</div>
                      </div>
                      <StatusChip status={a.status} />
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                      <div>{t('explorer.plannedStart')}: {fmtDate(a.plannedStart, i18n.language)}</div>
                      <div>{t('explorer.plannedEnd')}: {fmtDate(a.plannedEnd, i18n.language)}</div>
                      <div>{t('explorer.lastReported')}: <TimeAgo iso={a.lastReportedAt} /></div>
                    </div>
                    <ProgressBar value={a.progressPct} className="mt-2" />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
          )
        })}
      </div>
    </div>
  )
}
