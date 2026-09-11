import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUi } from '../../store/ui'
import { getDashboard } from '../../services/api'
import { Card, CardHeader, CardBody, ProgressBar, PageHeader, EmptyState, Button } from '../../components/ui'
import { StatusChip } from '../../components/ui/StatusChip'
import { DisciplineChip } from '../../components/ui/DisciplineChip'
import { AuditRow } from '../../components/shared/AuditRow'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function DashboardPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard', activeProjectId],
    queryFn: () => getDashboard(activeProjectId || ''),
    enabled: Boolean(activeProjectId),
  })

  if (isLoading || !dashboard) {
    return <PageHeader title={t('dashboard.title')} />
  }

  const kpi = [
    { label: t('dashboard.overallProgress'), value: `${dashboard.overallProgress}%`, sub: `${t('dashboard.planned')}: ${dashboard.plannedProgress}%` },
    { label: t('dashboard.completedActivities'), value: `${dashboard.completedCount}/${dashboard.totalCount}`, sub: '' },
    { label: t('dashboard.openDelays'), value: dashboard.openDelays, sub: '', href: '/m/delays', alert: dashboard.openDelays > 0 },
    { label: t('dashboard.pendingReviews'), value: dashboard.pendingReviews, sub: '', href: '/m/reconciliation', alert: dashboard.pendingReviews > 0 },
    { label: t('dashboard.awaitingReply'), value: dashboard.awaitingReply, sub: '', href: '/m/messages', alert: dashboard.awaitingReply > 0 },
    { label: t('dashboard.daysRemaining'), value: dashboard.daysRemaining, sub: t('common.days'), href: null },
  ]

  return (
    <div>
      <PageHeader title={t('dashboard.title')} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpi.map((item) =>
          item.href ? (
            <Link key={item.label} to={item.href} className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow ${item.alert ? 'border-rose-200' : 'border-slate-200'}`}>
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className={`mt-1 text-2xl font-bold ${item.alert ? 'text-rose-600' : 'text-slate-800'}`}>{item.value}</div>
              {item.sub && <div className="text-[10px] text-slate-400">{item.sub}</div>}
            </Link>
          ) : (
            <div key={item.label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs text-slate-500">{item.label}</div>
              <div className="mt-1 text-2xl font-bold text-slate-800">{item.value}</div>
              {item.sub && <div className="text-[10px] text-slate-400">{item.sub}</div>}
            </div>
          )
        )}
      </div>

      <div className="mb-5 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('dashboard.progressTrend')} />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.progressTrend}>
                  <defs>
                    <linearGradient id="colorPlanned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#1f57e9" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#1f57e9" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="planned" stroke="#94a3b8" fillOpacity={1} fill="url(#colorPlanned)" strokeWidth={2} />
                  <Area type="monotone" dataKey="actual" stroke="#1f57e9" fillOpacity={1} fill="url(#colorActual)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.disciplineProgress')} />
          <CardBody className="space-y-3">
            {dashboard.disciplineProgress.map((d) => (
              <div key={d.discipline}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <DisciplineChip discipline={d.discipline} />
                  <span className="text-slate-600">{d.progress}%</span>
                </div>
                <ProgressBar value={d.progress} barClassName={d.colorClass} />
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={t('dashboard.delayedAtRisk')}
            action={
              <Link to="/m/delays">
                <Button variant="ghost" size="sm" icon="arrowRight">{t('common.viewAll')}</Button>
              </Link>
            }
          />
          <CardBody>
            {dashboard.delayedActivities.length === 0 ? (
              <EmptyState icon="delays" title={t('dashboard.noDelayed')} />
            ) : (
              <div className="space-y-2">
                {dashboard.delayedActivities.map(({ activity, daysLate, reason }) => (
                  <Link key={activity.id} to={`/m/schedule?activity=${activity.id}`} className="flex items-center justify-between rounded border border-slate-100 bg-slate-50 px-3 py-2 hover:border-slate-200">
                    <div>
                      <div className="text-sm font-medium text-slate-800">{activity.name}</div>
                      <div className="font-mono text-[10px] text-slate-500">{activity.id}</div>
                    </div>
                    <div className="text-right">
                      <StatusChip status={activity.status} />
                      <div className="text-[10px] text-slate-500">
                        {daysLate} {t('common.days')} · {reason}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('dashboard.recentActivity')} />
          <CardBody className="divide-y divide-slate-100">
            {dashboard.recentAudit.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
