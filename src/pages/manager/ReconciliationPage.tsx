import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useUi } from '../../store/ui'
import { getReconciliationQueue, getAutoApprovedLog, getActivity, decideMatch } from '../../services/api'
import { PageHeader, Card, Tabs, BandChip, ConfidenceMeter, DecisionChip, Button, TimeAgo } from '../../components/ui'
import { ActivityPickerModal } from '../../components/shared/ActivityPickerModal'
import { Textarea } from '../../components/ui/Form'
import { StatusChip } from '../../components/ui/StatusChip'
import { useToast } from '../../store/toast'
import type { AiMatchResult } from '../../types/domain'

export function ReconciliationPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const [tab, setTab] = useState<'review' | 'log'>('review')
  const { data: queue = [], refetch } = useQuery({ queryKey: ['reconQueue', activeProjectId], queryFn: () => getReconciliationQueue(activeProjectId || '') })
  const { data: log = [] } = useQuery({ queryKey: ['autoLog', activeProjectId], queryFn: () => getAutoApprovedLog(activeProjectId || '') })

  return (
    <div>
      <PageHeader title={t('recon.title')} subtitle={t('recon.subtitle')} />
      <Card>
        <Tabs
          tabs={[
            { key: 'review', label: t('recon.needsReview'), badge: queue.length },
            { key: 'log', label: t('recon.autoApprovedLog') },
          ]}
          active={tab}
          onChange={(k) => setTab(k as 'review' | 'log')}
        />
        <div className="p-4">
          {tab === 'review' && (
            <div className="space-y-4">
              {queue.length === 0 && <div className="py-8 text-center text-sm text-slate-500">{t('recon.noPending')}</div>}
              {queue.map((match) => (
                <ReviewCard key={match.id} match={match} onAction={() => refetch()} />
              ))}
            </div>
          )}
          {tab === 'log' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr>
                    <th className="pb-2">{t('common.source')}</th>
                    <th className="pb-2">{t('recon.extractedText')}</th>
                    <th className="pb-2">{t('recon.matchedTo')}</th>
                    <th className="pb-2">{t('common.status')}</th>
                    <th className="pb-2">{t('common.confidence')}</th>
                    <th className="pb-2">{t('recon.decidedBy')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {log.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-slate-500">{t('recon.noAuto')}</td></tr>}
                  {log.map((m) => (
                    <tr key={m.id}>
                      <td className="py-2">{t(`common.sources.${m.source}`)}</td>
                      <td className="py-2 max-w-xs truncate">{m.extractedActivity}</td>
                      <td className="py-2">{m.matchedActivityId ? <span className="font-mono text-xs">{m.matchedActivityId}</span> : '—'}</td>
                      <td className="py-2">{m.status && <StatusChip status={m.status} />}</td>
                      <td className="py-2"><ConfidenceMeter value={m.confidence} band={m.band} /></td>
                      <td className="py-2"><DecisionChip decision={m.decision} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

function ReviewCard({ match, onAction }: { match: AiMatchResult; onAction: () => void }) {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const push = useToast((s) => s.push)
  const [selectedCandidate, setSelectedCandidate] = useState(match.candidates[0]?.activityId ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)
  const matchedActivity = match.matchedActivityId ? getActivity(activeProjectId || '', match.matchedActivityId) : undefined

  const handleAccept = async () => {
    await decideMatch(match.id, 'ACCEPT', 'u-mgr-01')
    push(t('recon.accepted'), 'success')
    onAction()
  }

  const handleLink = async (activityId: string) => {
    await decideMatch(match.id, 'LINK', 'u-mgr-01', { activityId })
    push(t('recon.linked'), 'success')
    onAction()
  }

  const handleAsk = async () => {
    if (!question.trim()) return
    setAsking(true)
    await decideMatch(match.id, 'ASK', 'u-mgr-01', { question: question.trim(), activityId: selectedCandidate || undefined })
    setAsking(false)
    push(t('recon.asked'), 'success')
    onAction()
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <BandChip band={match.band} />
          <ConfidenceMeter value={match.confidence} band={match.band} />
        </div>
        <div className="text-xs text-slate-500">
          <TimeAgo iso={match.createdAt} />
        </div>
      </div>

      <div className="mb-3 rounded bg-slate-50 p-3 text-sm italic text-slate-700">"{match.extractedActivity}"</div>

      {match.band === 'REVIEW' && match.candidates.length > 0 && (
        <div className="mb-3 space-y-2">
          <div className="text-xs font-medium text-slate-600">{t('recon.candidateMatches')}</div>
          {match.candidates.map((c) => {
            const act = getActivity(activeProjectId || '', c.activityId)
            return (
              <label key={c.activityId} className={`flex cursor-pointer items-center gap-3 rounded border p-2 ${selectedCandidate === c.activityId ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                <input type="radio" name={match.id} checked={selectedCandidate === c.activityId} onChange={() => setSelectedCandidate(c.activityId)} />
                <div className="flex-1">
                  <div className="text-sm font-medium text-slate-800">{act?.name ?? c.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">{c.activityId} · {Math.round(c.confidence)}%</div>
                </div>
              </label>
            )
          })}
        </div>
      )}

      {match.band === 'UNMATCHED' && (
        <div className="mb-3">
          <div className="rounded bg-rose-50 p-2 text-xs text-rose-700">{t('recon.noCandidates')}</div>
        </div>
      )}

      {matchedActivity && match.band === 'AUTO' && (
        <div className="mb-3 flex items-center gap-2">
          <StatusChip status={match.status!} />
          <span className="text-sm text-slate-700">{matchedActivity.name}</span>
          <span className="font-mono text-xs text-slate-500">{matchedActivity.id}</span>
        </div>
      )}

      <div className="mb-3">
        <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('recon.questionPlaceholder')} />
      </div>

      <div className="flex flex-wrap gap-2">
        {match.band === 'REVIEW' && (
          <Button variant="primary" size="sm" onClick={handleAccept}>
            {t('recon.acceptMatch')}
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={() => setPickerOpen(true)} icon="link">
          {t('recon.linkActivity')}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleAsk} loading={asking} icon="messages">
          {t('recon.askSupervisor')}
        </Button>
      </div>

      <ActivityPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={activeProjectId || ''}
        title={t('recon.linkActivity')}
        onSelect={(a) => {
          handleLink(a.id)
          setPickerOpen(false)
        }}
      />
    </div>
  )
}
