import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Modal } from '../ui/Modal'
import { Input } from '../ui/Form'
import { Icon } from '../ui/Icon'
import { getActivities } from '../../services/api'
import type { ScheduleActivity } from '../../types/domain'
import { LevelTag } from '../ui/LevelTag'
import { DisciplineChip } from '../ui/DisciplineChip'

export function ActivityPickerModal({
  open,
  onClose,
  projectId,
  onSelect,
  title,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  onSelect: (activity: ScheduleActivity) => void
  title: string
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const { data: activities = [] } = useQuery({ queryKey: ['activities', projectId], queryFn: () => getActivities(projectId) })

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return activities
      .filter((a) => a.level === 'L6' || a.level === 'L5')
      .filter((a) => a.id.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))
      .slice(0, 50)
  }, [activities, search])

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <Input placeholder={t('explorer.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3" />
      <div className="max-h-80 overflow-y-auto rounded border border-slate-200">
        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">{t('common.noMatches')}</div>
        )}
        {filtered.map((a) => (
          <button
            key={a.id}
            onClick={() => onSelect(a)}
            className="flex w-full items-center gap-3 border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
          >
            <LevelTag level={a.level} />
            <DisciplineChip discipline={a.discipline} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{a.name}</div>
              <div className="font-mono text-[10px] text-slate-400">{a.id}</div>
            </div>
            <Icon name="chevronRight" size={16} className="text-slate-300" />
          </button>
        ))}
      </div>
    </Modal>
  )
}
