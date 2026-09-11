import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { getActivities, getUser } from '../../services/api'
import { useUi } from '../../store/ui'
import { PageHeader, Input, Select, Button, Card, CardBody, ProgressBar, Icon, Avatar, TimeAgo } from '../../components/ui'
import { LevelTag } from '../../components/ui/LevelTag'
import { StatusChip } from '../../components/ui/StatusChip'
import { DisciplineChip, DisciplineDot } from '../../components/ui/DisciplineChip'
import { AskActivityModal } from '../../components/shared/AskActivityModal'
import { ACTIVITY_STATUSES, ACTIVITY_LEVELS } from '../../config/constants'
import type { ScheduleActivity, Discipline } from '../../types/domain'
import { fmtDate } from '../../utils/dates'
import { cn } from '../../utils/cn'

export function ScheduleExplorerPage() {
  const { t, i18n } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const [params, setParams] = useSearchParams()
  const { data: activities = [], isLoading } = useQuery({ queryKey: ['activities', activeProjectId], queryFn: () => getActivities(activeProjectId || '') })

  const [search, setSearch] = useState('')
  const [discipline, setDiscipline] = useState('')
  const [status, setStatus] = useState('')
  const [level, setLevel] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(params.get('activity'))
  const [askOpen, setAskOpen] = useState(false)

  useEffect(() => {
    const id = params.get('activity')
    if (id) {
      setSelectedId(id)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const { byParent, byId } = useMemo(() => {
    const byParent = new Map<string, ScheduleActivity[]>()
    const byId = new Map<string, ScheduleActivity>()
    activities.forEach((a) => {
      byId.set(a.id, a)
      if (a.parentId) {
        const list = byParent.get(a.parentId) ?? []
        list.push(a)
        byParent.set(a.parentId, list)
      }
    })
    return { byParent, byId }
  }, [activities])

  const filteredIds = useMemo(() => {
    const q = search.toLowerCase()
    const ids = new Set<string>()
    activities.forEach((a) => {
      const matchesSearch = !q || a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
      const matchesDiscipline = !discipline || a.discipline === discipline
      const matchesStatus = !status || a.status === status
      const matchesLevel = !level || a.level === level
      if (matchesSearch && matchesDiscipline && matchesStatus && matchesLevel) {
        ids.add(a.id)
        let cur = a
        while (cur.parentId) {
          ids.add(cur.parentId)
          cur = byId.get(cur.parentId)!
        }
      }
    })
    return ids
  }, [activities, search, discipline, status, level, byId])

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev)
      filteredIds.forEach((id) => {
        const node = byId.get(id)
        if (node && byParent.get(id)?.length) {
          next.add(id)
        }
      })
      return next
    })
  }, [filteredIds, byId, byParent])

  const root = activities.find((a) => a.parentId === null)
  const selected = selectedId ? byId.get(selectedId) : null

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandAll = () => setExpanded(new Set(activities.map((a) => a.id)))
  const collapseAll = () => setExpanded(new Set())

  const renderNode = (node: ScheduleActivity, depth = 0) => {
    if (!filteredIds.has(node.id)) return null
    const children = byParent.get(node.id) ?? []
    const isOpen = expanded.has(node.id)
    const isSelected = selectedId === node.id
    const hasChildren = children.length > 0
    const assignee = node.assigneeId ? getUser(node.assigneeId) : null

    return (
      <div key={node.id}>
        <div
          onClick={() => setSelectedId(node.id)}
          className={cn(
            'flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 transition-colors hover:bg-slate-50',
            isSelected && 'bg-brand-50 hover:bg-brand-50'
          )}
          style={{ paddingLeft: `${12 + depth * 20}px` }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleExpand(node.id)
            }}
            className={cn('flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-200', !hasChildren && 'invisible')}
          >
            <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
          </button>
          <LevelTag level={node.level} />
          <DisciplineDot discipline={node.discipline} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-slate-800">{node.name}</div>
            <div className="font-mono text-[10px] text-slate-400">{node.id}</div>
          </div>
          <StatusChip status={node.status} className="hidden sm:inline-flex" />
          {node.lastReportedAt && <span className="hidden rounded bg-violet-50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-violet-700 lg:inline">AI</span>}
          {assignee && <Avatar initials={assignee.avatarInitials} size="sm" />}
        </div>
        {isOpen && children.map((child) => renderNode(child, depth + 1))}
      </div>
    )
  }

  if (isLoading) return <PageHeader title={t('explorer.title')} />

  return (
    <div>
      <PageHeader title={t('explorer.title')} subtitle={t('explorer.subtitle')} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input placeholder={t('explorer.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-64" />
        <Select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="w-full sm:w-40">
          <option value="">{t('explorer.allDisciplines')}</option>
          {(['CIVIL', 'PIPING', 'ELECTRICAL', 'INSTRUMENTATION', 'EQUIPMENT', 'HSE'] as Discipline[]).map((d) => (
            <option key={d} value={d}>{t(`discipline.${d}`)}</option>
          ))}
        </Select>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full sm:w-40">
          <option value="">{t('explorer.allStatuses')}</option>
          {ACTIVITY_STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </Select>
        <Select value={level} onChange={(e) => setLevel(e.target.value)} className="w-full sm:w-32">
          <option value="">{t('explorer.allLevels')}</option>
          {ACTIVITY_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </Select>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>{t('explorer.expandAll')}</Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>{t('explorer.collapseAll')}</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="max-h-[32rem] overflow-y-auto">
            {root ? renderNode(root) : <div className="p-6 text-center text-sm text-slate-500">{t('common.noData')}</div>}
          </div>
        </Card>

        <Card>
          <CardBody>
            {selected ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2">
                    <LevelTag level={selected.level} />
                    <DisciplineChip discipline={selected.discipline} />
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-800">{selected.name}</h3>
                  <div className="font-mono text-xs text-slate-500">{selected.id}</div>
                </div>
                <div className="space-y-2 text-sm">
                  <DetailRow label={t('explorer.plannedStart')} value={fmtDate(selected.plannedStart, i18n.language)} />
                  <DetailRow label={t('explorer.plannedEnd')} value={fmtDate(selected.plannedEnd, i18n.language)} />
                  <DetailRow label={t('explorer.actualStart')} value={fmtDate(selected.actualStart, i18n.language) || t('common.notAvailable')} />
                  <DetailRow label={t('explorer.actualEnd')} value={fmtDate(selected.actualEnd, i18n.language) || t('common.notAvailable')} />
                  <DetailRow label={t('explorer.lastReported')} value={<TimeAgo iso={selected.lastReportedAt} />} />
                </div>
                <div>
                  <div className="mb-1 text-xs text-slate-500">{t('common.progress')}</div>
                  <ProgressBar value={selected.progressPct} />
                </div>
                <div className="flex items-center gap-2">
                  <StatusChip status={selected.status} />
                  {selected.assigneeId ? (
                    <span className="text-xs text-slate-600">{getUser(selected.assigneeId)?.name}</span>
                  ) : (
                    <span className="text-xs text-slate-400">{t('common.notAssigned')}</span>
                  )}
                </div>
                <Button variant="primary" size="sm" className="w-full" onClick={() => setAskOpen(true)}>
                  {t('explorer.askAboutActivity')}
                </Button>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">{t('explorer.selectActivity')}</div>
            )}
          </CardBody>
        </Card>
      </div>

      {selected && (
        <AskActivityModal open={askOpen} onClose={() => setAskOpen(false)} projectId={activeProjectId || ''} preselectedActivityId={selected.id} />
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between border-b border-slate-50 pb-1">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-800">{value}</span>
    </div>
  )
}
