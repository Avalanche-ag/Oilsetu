import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { getWorkerDashboard, getProjects, markWorkerAttendance } from '../../services/api'
import { Card, CardBody, Button, Chip, PageHeader } from '../../components/ui'
import { fmtDate } from '../../utils/dates'
import { useToast } from '../../store/toast'
import type { WorkerAttendanceStatus } from '../../types/domain'

export function WorkerDashboardPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const setActiveProjectId = useUi((s) => s.setActiveProjectId)
  const push = useToast((s) => s.push)
  const qc = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState<WorkerAttendanceStatus>('PTO')
  const [reason, setReason] = useState('')

  const { data: projects = [], isLoading: projectsLoading } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const projectId = projects.some((project) => project.id === activeProjectId) ? activeProjectId || '' : projects[0]?.id || ''
  const { data, isLoading, isError } = useQuery({
    queryKey: ['workerDashboard', userId, projectId],
    queryFn: () => getWorkerDashboard(projectId),
    enabled: Boolean(userId && projectId),
  })

  useEffect(() => {
    if (!activeProjectId && projectId) setActiveProjectId(projectId)
  }, [activeProjectId, projectId, setActiveProjectId])

  const attendanceMutation = useMutation({
    mutationFn: () => markWorkerAttendance({ projectId, date, status, reason: reason || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workerDashboard', userId, projectId] })
      push(t('worker.attendanceSaved'), 'success')
      setReason('')
    },
    onError: () => push(t('worker.attendanceFailed'), 'error'),
  })

  if (projectsLoading || isLoading) return <div className="py-12 text-center text-sm text-slate-500">{t('common.loading')}</div>
  if (isError || !data) return <div className="py-12 text-center text-sm text-rose-600">{t('worker.dashboardError')}</div>

  return (
    <div className="space-y-4">
      <PageHeader title={t('worker.dashboardTitle')} subtitle={t('worker.dashboardSubtitle')} />
      <div className="grid grid-cols-3 gap-2">
        <Stat value={data.summary.presentDays} label={t('worker.presentDays')} color="text-emerald-600" />
        <Stat value={data.summary.absentDays} label={t('worker.absentDays')} color="text-rose-600" />
        <Stat value={data.summary.leaveDays} label={t('worker.leaveDays')} color="text-amber-600" />
      </div>

      <Card>
        <CardBody>
          <div className="mb-3 text-sm font-semibold text-slate-800">{t('worker.markLeaveTitle')}</div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-slate-600">
              {t('worker.date')}
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm" />
            </label>
            <label className="text-xs text-slate-600">
              {t('worker.leaveType')}
              <select value={status} onChange={(e) => setStatus(e.target.value as WorkerAttendanceStatus)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm">
                <option value="PTO">{t('worker.pto')}</option>
                <option value="LEAVE">{t('worker.leave')}</option>
              </select>
            </label>
            <label className="text-xs text-slate-600">
              {t('worker.reason')}
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('worker.reasonPlaceholder')} className="mt-1 w-full rounded border border-slate-300 px-2 py-2 text-sm" />
            </label>
          </div>
          <Button className="mt-3" variant="primary" loading={attendanceMutation.isPending} onClick={() => attendanceMutation.mutate()}>
            {t('worker.saveAttendance')}
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-3 text-sm font-semibold text-slate-800">{t('worker.attendanceHistory')}</div>
          <div className="space-y-2">
            {data.attendance.length === 0 && <div className="text-sm text-slate-500">{t('worker.noAttendance')}</div>}
            {data.attendance.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-2">
                <div className="text-sm text-slate-700">{fmtDate(item.date, i18n.language)}</div>
                <div className="flex items-center gap-2">
                  <Chip color={item.status === 'PRESENT' ? 'emerald' : item.status === 'ABSENT' ? 'rose' : 'amber'}>{t(`worker.status.${item.status}`)}</Chip>
                  {item.reason && <span className="text-xs text-slate-500">{item.reason}</span>}
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-3 text-sm font-semibold text-slate-800">{t('worker.assignedTasks')}</div>
          <div className="space-y-2">
            {data.assignments.length === 0 && <div className="text-sm text-slate-500">{t('worker.noTasks')}</div>}
            {data.assignments.map((assignment) => (
              <div key={assignment.id} className="rounded border border-slate-100 p-3">
                <div className="text-sm font-medium text-slate-800">{assignment.activityName}</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">{assignment.activityId}</div>
                {assignment.activityStatus && <div className="mt-1 text-xs text-slate-500">{t(`status.${assignment.activityStatus}`)}</div>}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

function Stat({ value, label, color }: { value: number; label: string; color: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-[10px] text-slate-500">{label}</div></div>
}
