import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useUi } from '../../store/ui'
import { getDelays, getAtRiskActivities, getActivity } from '../../services/api'
import { PageHeader, Card, CardHeader, CardBody, StatusChip, Chip, TimeAgo, EmptyState } from '../../components/ui'
import { DisciplineChip } from '../../components/ui/DisciplineChip'

export function DelaysPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const { data: delays = [] } = useQuery({ queryKey: ['delays', activeProjectId], queryFn: () => getDelays(activeProjectId || '') })
  const { data: atRisk = [] } = useQuery({ queryKey: ['atRisk', activeProjectId], queryFn: () => getAtRiskActivities(activeProjectId || '') })

  return (
    <div>
      <PageHeader title={t('delays.title')} subtitle={t('delays.subtitle')} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title={t('delays.openDelays')} />
          <CardBody>
            {delays.length === 0 ? (
              <EmptyState icon="delays" title={t('delays.noDelays')} />
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2">{t('common.activity')}</th>
                    <th className="pb-2">{t('common.discipline')}</th>
                    <th className="pb-2">{t('delays.reason')}</th>
                    <th className="pb-2">{t('delays.aging')}</th>
                    <th className="pb-2">{t('common.status')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {delays.map((d) => {
                    const activity = getActivity(activeProjectId || '', d.activityId)
                    return (
                      <tr key={d.id}>
                        <td className="py-2">
                          <div className="font-medium text-slate-800">{activity?.name}</div>
                          <div className="font-mono text-[10px] text-slate-500">{d.activityId}</div>
                        </td>
                        <td className="py-2"><DisciplineChip discipline={activity?.discipline ?? null} /></td>
                        <td className="py-2">
                          <Chip color="rose">{t(`delayReason.${d.reasonCode}`)}</Chip>
                          <div className="mt-0.5 max-w-xs truncate text-xs text-slate-500">{d.reasonText}</div>
                        </td>
                        <td className="py-2 text-slate-600">
                          <TimeAgo iso={d.reportedAt} />
                        </td>
                        <td className="py-2"><StatusChip status={activity?.status ?? 'NOT_STARTED'} /></td>
                        <td className="py-2 text-right">
                          <Link to={`/m/schedule?activity=${d.activityId}`} className="text-xs font-medium text-brand-600 hover:underline">
                            {t('delays.viewActivity')}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title={t('delays.atRisk')} />
          <CardBody>
            {atRisk.length === 0 ? (
              <EmptyState icon="alertCircle" title={t('delays.noAtRisk')} />
            ) : (
              <div className="space-y-2">
                {atRisk.map(({ activity, reason }) => (
                  <Link key={activity.id} to={`/m/schedule?activity=${activity.id}`} className="block rounded border border-slate-100 bg-slate-50 p-2 hover:border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{activity.name}</span>
                      <Chip color={reason === 'stale' ? 'amber' : 'rose'}>{t(reason === 'stale' ? 'delays.staleReporting' : 'delays.deadlinePressure')}</Chip>
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">{activity.id}</div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
