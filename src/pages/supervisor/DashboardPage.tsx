import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { getUser, getSupervisorWork, getSupervisorThreads, getSupervisorReports } from '../../services/api'
import { Card, CardBody, Button, StatusChip, Icon } from '../../components/ui'

export function SupervisorDashboardPage() {
  const { t } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const user = userId ? getUser(userId) : undefined
  const { data: work = [] } = useQuery({ queryKey: ['supWork', userId], queryFn: () => getSupervisorWork(userId || ''), enabled: Boolean(userId) })
  const { data: threads = [] } = useQuery({ queryKey: ['supThreads', userId], queryFn: () => getSupervisorThreads(userId || ''), enabled: Boolean(userId) })
  const { data: reports = [] } = useQuery({ queryKey: ['supReports', userId], queryFn: () => getSupervisorReports(userId || ''), enabled: Boolean(userId) })

  const pendingQuestions = threads.filter((t) => t.status === 'OPEN' && t.messages[t.messages.length - 1]?.senderId !== userId).length
  const reportedToday = reports.some((r) => r.reportDate === new Date().toISOString().slice(0, 10))
  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })

  const stats = {
    assigned: work.length,
    completed: work.filter((a) => a.status === 'COMPLETED').length,
    inProgress: work.filter((a) => a.status === 'IN_PROGRESS').length,
    delayed: work.filter((a) => a.status === 'DELAYED').length,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-sm text-slate-500">{today}</div>
      <h1 className="text-xl font-semibold text-slate-900">{t('sup.dashboard.greeting', { name: user?.name.split(' ')[0] ?? '' })}</h1>

      {pendingQuestions > 0 && (
        <Link to="/s/chat" className="block rounded-lg border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Icon name="chat" size={16} />
            {pendingQuestions} {t('sup.dashboard.pendingQuestions')}
          </div>
          <div className="text-xs text-amber-700">{t('sup.dashboard.pendingQuestionsDesc')}</div>
        </Link>
      )}

      <Card>
        <CardBody className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-700">
              {reportedToday ? t('sup.dashboard.reportedToday') : t('sup.dashboard.reportNow')}
            </div>
            <div className="text-xs text-slate-500">
              {reportedToday ? '' : t('sup.dashboard.todaysWork')}
            </div>
          </div>
          <Link to="/s/report">
            <Button variant="primary" icon="report">{reportedToday ? t('sup.report.reportMore') : t('sup.dashboard.reportNow')}</Button>
          </Link>
        </CardBody>
      </Card>

      <div className="grid grid-cols-4 gap-2">
        <StatBox value={stats.assigned} label={t('nav.myWork')} />
        <StatBox value={stats.completed} label={t('status.COMPLETED')} color="text-emerald-600" />
        <StatBox value={stats.inProgress} label={t('status.IN_PROGRESS')} color="text-blue-600" />
        <StatBox value={stats.delayed} label={t('status.DELAYED')} color="text-rose-600" />
      </div>

      <Card>
        <CardBody>
          <div className="mb-2 text-sm font-semibold text-slate-800">{t('sup.dashboard.todaysWork')}</div>
          {work.length === 0 ? (
            <div className="text-sm text-slate-500">{t('sup.dashboard.noAssigned')}</div>
          ) : (
            <div className="space-y-2">
              {work.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 p-2">
                  <div>
                    <div className="text-sm font-medium text-slate-800">{a.name}</div>
                    <div className="font-mono text-[10px] text-slate-500">{a.id}</div>
                  </div>
                  <StatusChip status={a.status} />
                </div>
              ))}
            </div>
          )}
          <Link to="/s/work" className="mt-3 block text-center text-xs font-medium text-brand-600">
            {t('sup.dashboard.viewAll')}
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

function StatBox({ value, label, color }: { value: number; label: string; color?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2 text-center">
      <div className={`text-xl font-bold ${color ?? 'text-slate-800'}`}>{value}</div>
      <div className="text-[10px] text-slate-500">{label}</div>
    </div>
  )
}
