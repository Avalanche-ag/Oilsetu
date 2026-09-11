import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getActivities, getAssignments, getUsers, createAssignment, unassign } from '../../services/api'
import { useUi } from '../../store/ui'
import { PageHeader, Card, CardHeader, CardBody, Button, Avatar } from '../../components/ui'
import { Textarea } from '../../components/ui/Form'
import { DisciplineChip } from '../../components/ui/DisciplineChip'
import { useToast } from '../../store/toast'
import type { ScheduleActivity } from '../../types/domain'

export function AssignmentsPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const push = useToast((s) => s.push)
  const { data: activities = [] } = useQuery({ queryKey: ['activities', activeProjectId], queryFn: () => getActivities(activeProjectId || '') })
  const { data: assignments = [], refetch: refetchAssignments } = useQuery({ queryKey: ['assignments', activeProjectId], queryFn: () => getAssignments(activeProjectId || '') })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: () => getUsers() })

  const supervisors = useMemo(() => users.filter((u) => u.role === 'supervisor'), [users])
  const packages = useMemo(() => activities.filter((a) => a.level === 'L4' || (a.level === 'L5' && !activities.some((x) => x.parentId === a.id))), [activities])

  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null)
  const [supervisorId, setSupervisorId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [included, setIncluded] = useState<Set<string>>(new Set())

  const selectedPkg = packages.find((p) => p.id === selectedPkgId)
  const pkgL6 = useMemo(() => {
    if (!selectedPkg) return []
    const collect = (id: string): ScheduleActivity[] => {
      const children = activities.filter((a) => a.parentId === id)
      if (children.length === 0) return activities.filter((a) => a.id === id)
      return children.flatMap((c) => collect(c.id))
    }
    return collect(selectedPkg.id).filter((a) => a.level === 'L6')
  }, [selectedPkg, activities])

  const existingAssignment = assignments.find((a) => a.workPackageId === selectedPkgId && a.status === 'ACTIVE')

  const selectPackage = (pkg: ScheduleActivity) => {
    setSelectedPkgId(pkg.id)
    const existing = assignments.find((a) => a.workPackageId === pkg.id && a.status === 'ACTIVE')
    setSupervisorId(existing?.supervisorId ?? '')
    setInstructions(existing?.instructions ?? '')
    setIncluded(new Set(existing?.includedL6Ids ?? pkgL6.map((a) => a.id)))
  }

  const toggleIncluded = (id: string) => {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAssign = async () => {
    if (!selectedPkgId || !supervisorId || included.size === 0) return
    await createAssignment({
      projectId: activeProjectId || '',
      workPackageId: selectedPkgId,
      supervisorId,
      includedL6Ids: Array.from(included),
      instructions,
    })
    push(t('toast.assignmentCreated'), 'success')
    refetchAssignments()
  }

  const handleUnassign = async (id: string) => {
    await unassign(id)
    push(t('toast.assignmentRemoved'), 'success')
    refetchAssignments()
  }

  return (
    <div>
      <PageHeader title={t('assign.title')} subtitle={t('assign.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title={t('assign.workPackages')} />
          <CardBody className="max-h-[32rem] space-y-2 overflow-y-auto">
            {packages.map((pkg) => {
              const assigned = assignments.find((a) => a.workPackageId === pkg.id && a.status === 'ACTIVE')
              return (
                <button
                  key={pkg.id}
                  onClick={() => selectPackage(pkg)}
                  className={`w-full rounded border p-3 text-left transition-colors ${selectedPkgId === pkg.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-800">{pkg.name}</span>
                    <DisciplineChip discipline={pkg.discipline} />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-slate-500">{pkg.id}</div>
                  {assigned && <div className="mt-1 text-xs text-brand-700">{t('common.assigned')}: {users.find((u) => u.id === assigned.supervisorId)?.name}</div>}
                </button>
              )
            })}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title={selectedPkg ? t('assign.assignWork') : t('assign.selectPackage')} />
          <CardBody>
            {selectedPkg ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{t('assign.supervisor')}</label>
                    <div className="space-y-2">
                      {supervisors.map((s) => (
                        <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded border p-2 ${supervisorId === s.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                          <input type="radio" name="supervisor" checked={supervisorId === s.id} onChange={() => setSupervisorId(s.id)} className="text-brand-600" />
                          <Avatar initials={s.avatarInitials} size="sm" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-800">{s.name}</div>
                            <div className="text-[10px] text-slate-500">{s.designation}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">{t('assign.instructions')}</label>
                    <Textarea rows={4} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder={t('common.optional')} />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('assign.includeL6')}</label>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
                    {pkgL6.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" checked={included.has(a.id)} onChange={() => toggleIncluded(a.id)} />
                        <span className="font-mono text-xs text-slate-500">{a.id}</span>
                        <span className="text-slate-700">{a.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  {existingAssignment && (
                    <Button variant="ghost" onClick={() => handleUnassign(existingAssignment.id)}>
                      {t('assign.unassign')}
                    </Button>
                  )}
                  <Button variant="primary" onClick={handleAssign} disabled={!supervisorId || included.size === 0}>
                    {existingAssignment ? t('assign.reassign') : t('assign.assignWork')}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">{t('assign.selectPackage')}</div>
            )}
          </CardBody>
        </Card>
      </div>

      {assignments.length > 0 && (
        <Card className="mt-4">
          <CardHeader title={t('assign.currentAssignments')} />
          <CardBody>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr>
                  <th className="pb-2">{t('common.activity')}</th>
                  <th className="pb-2">{t('common.supervisor')}</th>
                  <th className="pb-2">{t('common.instructions')}</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assignments.filter((a) => a.status === 'ACTIVE').map((a) => {
                  const pkg = activities.find((x) => x.id === a.workPackageId)
                  const sup = users.find((u) => u.id === a.supervisorId)
                  return (
                    <tr key={a.id}>
                      <td className="py-2">
                        <div className="font-medium text-slate-800">{pkg?.name}</div>
                        <div className="font-mono text-[10px] text-slate-500">{pkg?.id}</div>
                      </td>
                      <td className="py-2">{sup?.name}</td>
                      <td className="py-2 text-slate-500">{a.instructions || '—'}</td>
                      <td className="py-2 text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleUnassign(a.id)} icon="trash" />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
