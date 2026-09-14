import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { ApiError, assignWorkerTask, getSupervisorWork, getWorkerAssignments, getWorkers, markWorkerAttendance } from '../../services/api'
import { todayIso } from '../../utils/dates'
import { Button, Card, CardBody, Chip, Select } from '../ui'
import { useToast } from '../../store/toast'

export function WorkerManagementPanel() {
  const { t } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const projectId = useUi((s) => s.activeProjectId) || ''
  const push = useToast((s) => s.push)
  const qc = useQueryClient()
  const [selectedWorker, setSelectedWorker] = useState('')
  const [attendanceWorker, setAttendanceWorker] = useState('')
  const [selectedActivity, setSelectedActivity] = useState('')
  const [absenceReason, setAbsenceReason] = useState('')
  const { data: workers = [] } = useQuery({ queryKey: ['workers', projectId], queryFn: () => getWorkers(projectId, todayIso()), enabled: Boolean(projectId) })
  const { data: work = [] } = useQuery({ queryKey: ['supWork', userId], queryFn: () => getSupervisorWork(userId || ''), enabled: Boolean(userId) })
  const { data: workerAssignments = [] } = useQuery({ queryKey: ['workerAssignments', projectId], queryFn: () => getWorkerAssignments(projectId), enabled: Boolean(projectId) })
  const workerNames = new Map(workers.map((worker) => [worker.id, worker.name]))
  const manualWorker = workers.find((worker) => worker.id === selectedWorker)

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['workers', projectId] })
    qc.invalidateQueries({ queryKey: ['workerAssignments', projectId] })
    qc.invalidateQueries({ queryKey: ['supWork', userId] })
    qc.invalidateQueries({ queryKey: ['workerDashboard'] })
  }

  const absenceMutation = useMutation({
    mutationFn: (attendanceStatus: 'ABSENT' | 'PRESENT') => markWorkerAttendance({ projectId, workerId: attendanceWorker, date: todayIso(), status: attendanceStatus, reason: absenceReason || undefined }),
    onSuccess: (result, attendanceStatus) => {
      refresh()
      const count = result.reallocations.filter((item) => item.status === 'REALLOCATED').length
      const unallocated = result.reallocations.filter((item) => item.status === 'UNALLOCATED').length
      push(attendanceStatus === 'PRESENT' ? t('worker.attendanceSaved') : t('worker.reallocationResult', { count, unallocated }), count > 0 ? 'success' : 'info')
      setAttendanceWorker('')
      setAbsenceReason('')
    },
    onError: (err) => push(err instanceof ApiError && err.message ? err.message : t('worker.attendanceFailed'), 'error'),
  })

  const assignmentMutation = useMutation({
    mutationFn: () => assignWorkerTask({ projectId, workerId: selectedWorker, activityId: selectedActivity }),
    onSuccess: () => {
      refresh()
      push(t('worker.assignmentSaved'), 'success')
      setSelectedActivity('')
    },
    onError: (err) => push(err instanceof ApiError && err.message ? err.message : t('worker.assignmentFailed'), 'error'),
  })

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-800">{t('worker.managementTitle')}</div>
            <div className="text-xs text-slate-500">{t('worker.managementSubtitle')}</div>
          </div>
          <Chip color="blue">{workers.length}</Chip>
        </div>
        <div className="space-y-2">
          {workers.map((worker) => (
            <div key={worker.id} className="rounded border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{worker.name}</div>
                  <div className="text-xs text-slate-500">{worker.discipline} · {t('worker.activeTasks', { n: worker.activeTaskCount })}</div>
                </div>
                <Chip color={worker.attendanceStatus === 'ABSENT' ? 'rose' : worker.attendanceStatus === 'PTO' || worker.attendanceStatus === 'LEAVE' ? 'amber' : 'emerald'}>
                  {worker.attendanceStatus ? t(`worker.status.${worker.attendanceStatus}`) : t('worker.status.PRESENT')}
                </Chip>
              </div>
              <div className="mt-2 text-[10px] text-slate-500">{t('worker.availability')}: {worker.availability}% · {t('worker.workload')}: {worker.workload}</div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="danger" disabled={worker.attendanceStatus === 'ABSENT'} onClick={() => setAttendanceWorker(worker.id)}>
                  {attendanceWorker === worker.id ? t('worker.selected') : t('worker.markAbsent')}
                </Button>
                {attendanceWorker === worker.id && (
                  <input value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder={t('worker.reasonPlaceholder')} className="min-w-36 rounded border border-slate-300 px-2 py-1 text-xs" />
                )}
                {attendanceWorker === worker.id && <Button size="sm" variant="primary" loading={absenceMutation.isPending} onClick={() => absenceMutation.mutate('ABSENT')}>{t('worker.confirmAbsence')}</Button>}
                {attendanceWorker === worker.id && <Button size="sm" variant="ghost" loading={absenceMutation.isPending} onClick={() => absenceMutation.mutate('PRESENT')}>{t('worker.markPresent')}</Button>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 border-t border-slate-100 pt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('worker.manualAssignment')}</div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Select value={selectedWorker} onChange={(e) => setSelectedWorker(e.target.value)}>
              <option value="">{t('worker.chooseWorker')}</option>
              {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name} · {worker.discipline}</option>)}
            </Select>
            <Select value={selectedActivity} onChange={(e) => setSelectedActivity(e.target.value)}>
              <option value="">{t('worker.chooseTask')}</option>
              {work.map((activity) => {
                const mismatch = Boolean(manualWorker && activity.discipline && manualWorker.discipline !== activity.discipline)
                return <option key={activity.id} value={activity.id} disabled={mismatch}>{activity.id} · {activity.name}{mismatch ? ` (${activity.discipline})` : ''}</option>
              })}
            </Select>
          </div>
          <Button className="mt-2" size="sm" variant="secondary" disabled={!selectedWorker || !selectedActivity} loading={assignmentMutation.isPending} onClick={() => assignmentMutation.mutate()}>
            {t('worker.assignTask')}
          </Button>
          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{t('worker.allocationTableTitle')}</div>
            <div className="mb-2 text-xs text-slate-500">{t('worker.liveAllocationHint')}</div>
            <div className="overflow-x-auto rounded border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">{t('worker.tableWork')}</th>
                    <th className="px-3 py-2">{t('worker.tableAssignedTo')}</th>
                    <th className="px-3 py-2">{t('worker.tableMethod')}</th>
                    <th className="px-3 py-2">{t('worker.tableChangedFrom')}</th>
                    <th className="px-3 py-2">{t('worker.tableReason')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {workerAssignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td className="px-3 py-2 font-mono text-slate-700">{assignment.activityId}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{workerNames.get(assignment.workerId) ?? assignment.workerId}</td>
                      <td className="px-3 py-2 text-slate-600">{assignment.source === 'AUTO_REALLOCATION' ? t('worker.autoReallocation') : assignment.source === 'MANUAL' ? t('worker.manual') : t('worker.seed')}</td>
                      <td className="px-3 py-2 text-slate-600">{assignment.replacedWorkerId ? workerNames.get(assignment.replacedWorkerId) ?? assignment.replacedWorkerId : t('worker.noReplacement')}</td>
                      <td className="px-3 py-2 text-slate-500">{assignment.reason ?? t('worker.noReason')}</td>
                    </tr>
                  ))}
                  {workerAssignments.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-slate-500">{t('worker.noAssignments')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
