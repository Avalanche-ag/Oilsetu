import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getInsights, getDashboard } from '../../services/api'
import { useUi } from '../../store/ui'
import { PageHeader, Card, CardHeader, CardBody, ProgressBar, SimulatedAiTag } from '../../components/ui'
import { DisciplineChip } from '../../components/ui/DisciplineChip'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  ComposedChart,
} from 'recharts'

export function InsightsPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const { data: insights } = useQuery({ queryKey: ['insights'], queryFn: getInsights })
  const { data: dashboard } = useQuery({ queryKey: ['dashboard', activeProjectId], queryFn: () => getDashboard(activeProjectId || ''), enabled: Boolean(activeProjectId) })

  if (!insights) return <PageHeader title={t('insights.title')} />

  const delayTotal = insights.delayReasons.reduce((sum, d) => sum + d.count, 0) || 1
  const delayWithCum = insights.delayReasons.map((d, idx) => ({
    ...d,
    pct: Math.round((d.count / delayTotal) * 100),
    cum: Math.round((insights.delayReasons.slice(0, idx + 1).reduce((s, x) => s + x.count, 0) / delayTotal) * 100),
  }))

  return (
    <div>
      <PageHeader title={t('insights.title')} subtitle={t('insights.subtitle')} action={<SimulatedAiTag />} />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={t('insights.plannedVsActual')} />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.plannedVsActual.map((d) => ({ ...d, name: t(`discipline.${d.discipline}`) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planned" name={t('dashboard.planned')} fill="#94a3b8" />
                  <Bar dataKey="actual" name="Actual" fill="#1f57e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('insights.delayReasons')} />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={delayWithCum.map((d) => ({ ...d, name: t(`delayReason.${d.code}`) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="count" fill="#f59e0b" />
                  <Line yAxisId="right" type="monotone" dataKey="cum" stroke="#1f57e9" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('insights.productivityTrend')} />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={insights.productivity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[80, 105]} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="planned" stroke="#94a3b8" strokeDasharray="4 4" />
                  <Line type="monotone" dataKey="actual" stroke="#1f57e9" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('insights.topDelayed')} />
          <CardBody>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insights.topDelayed} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="occurrences" fill="#ef4444" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('insights.disciplineOnTime')} />
          <CardBody className="space-y-3">
            {insights.disciplineOnTime.map((d) => (
              <div key={d.discipline}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <DisciplineChip discipline={d.discipline} />
                  <span className="text-slate-600">{d.onTimePct}%</span>
                </div>
                <ProgressBar value={d.onTimePct} />
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('insights.currentProgress')} />
          <CardBody className="space-y-3">
            {dashboard?.disciplineProgress.map((d) => (
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

      <Card>
        <CardHeader title={t('insights.patterns')} />
        <CardBody className="grid gap-3 md:grid-cols-2">
          {insights.patterns.map((p) => (
            <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-1 text-sm font-semibold text-slate-800">{t(p.titleKey)}</div>
              <div className="text-xs leading-relaxed text-slate-600">{t(p.bodyKey)}</div>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
