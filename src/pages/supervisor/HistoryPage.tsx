import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { getSupervisorReports } from '../../services/api'
import { PageHeader, Card, CardBody, StatusChip, TimeAgo } from '../../components/ui'

export function HistoryPage() {
  const { t } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const { data: reports = [] } = useQuery({ queryKey: ['supReports', userId], queryFn: () => getSupervisorReports(userId || ''), enabled: Boolean(userId) })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('sup.history.title')} subtitle={t('sup.history.subtitle')} />
      {reports.length === 0 && <div className="py-8 text-center text-sm text-slate-500">{t('sup.history.noReports')}</div>}
      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardBody>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">{report.reportDate}</div>
                <div className="text-xs text-slate-500">{t(`common.sources.${report.source}`)} · <TimeAgo iso={report.submittedAt} /></div>
              </div>
              <div className="mb-3 text-sm text-slate-600">{report.rawContent}</div>
              <div className="space-y-2">
                {report.entries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between rounded border border-slate-100 p-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{entry.extractedText}</div>
                    </div>
                    <div className="text-right">
                      {entry.status && <StatusChip status={entry.status} />}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  )
}
