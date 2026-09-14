import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { aiService, submitReport, getSupervisorReports, getWorkers } from '../../services/api'
import { todayIso } from '../../utils/dates'
import { PageHeader, Card, CardBody, Button, SegmentedTabs, Textarea, Select, BandChip, ConfidenceMeter, Chip, SimulatedAiTag, TimeAgo, Icon } from '../../components/ui'
import { DisciplineChip } from '../../components/ui/DisciplineChip'
import { useToast } from '../../store/toast'
import type { PreviewEntry, ActivityStatus, DelayReasonCode, ReallocationResult } from '../../types/domain'
import { DELAY_REASONS } from '../../config/constants'

const DEMO_TEXT = {
  en: "Line 24 spool erection completed today. Line 25 has started. Line 26 is delayed because material hasn't arrived.",
  hi: 'लाइन 24 स्पूल एरेक्शन आज पूरा हुआ। लाइन 25 शुरू हो गई है। लाइन 26 में सामग्री न आने के कारण देरी है।',
}

const FILE_TEXT = {
  en: 'Site diary Day 48. Line 24 spool erection and welding complete. Hydro test pending. Line 25 spools staged at site.',
  hi: 'साइट डायरी दिवस 48। लाइन 24 स्पूल एरेक्शन और वेल्डिंग पूर्ण। हाइड्रो टेस्ट लंबित। लाइन 25 के स्पूल साइट पर रखे गए हैं।',
}

export function ReportPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const qc = useQueryClient()
  const push = useToast((s) => s.push)
  const navigate = useNavigate()
  const [tab, setTab] = useState<'text' | 'voice' | 'file'>('text')
  const [rawText, setRawText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [entries, setEntries] = useState<PreviewEntry[]>([])
  const [submitted, setSubmitted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [fileName, setFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [absentWorkerIds, setAbsentWorkerIds] = useState<string[]>([])
  const [absenceReason, setAbsenceReason] = useState('')
  const [reallocations, setReallocations] = useState<ReallocationResult[]>([])

  const { data: reports = [] } = useQuery({ queryKey: ['supReports', userId], queryFn: () => getSupervisorReports(userId || ''), enabled: Boolean(userId) })
  const { data: workers = [] } = useQuery({ queryKey: ['workers', activeProjectId], queryFn: () => getWorkers(activeProjectId || '', todayIso()), enabled: Boolean(activeProjectId) })
  const todayReports = reports.filter((r) => r.reportDate === todayIso())

  const analyze = async () => {
    if (!rawText.trim() || !activeProjectId || !userId) return
    setAnalyzing(true)
    const result = await aiService.processReport(rawText.trim(), {
      projectId: activeProjectId,
      supervisorId: userId,
      source: tab === 'file' ? 'FILE' : tab === 'voice' ? 'VOICE' : 'TEXT',
      language: i18n.language,
    })
    setEntries(result)
    setAnalyzing(false)
  }

  const submit = async () => {
    if (!activeProjectId || !userId || entries.length === 0) return
    const result = await submitReport({
      projectId: activeProjectId,
      supervisorId: userId,
      source: tab === 'file' ? 'FILE' : tab === 'voice' ? 'VOICE' : 'TEXT',
      rawContent: rawText,
      fileName: tab === 'file' ? fileName || 'upload.pdf' : undefined,
      absentWorkerIds,
      absenceDate: todayIso(),
      absenceReason: absenceReason || undefined,
      entries,
    })
    setReallocations(result.reallocations ?? [])
    push(t('toast.reportSubmitted'), 'success')
    qc.invalidateQueries()
    setSubmitted(true)
  }

  const startVoice = () => {
    setRecording(true)
    setRawText('')
    setEntries([])
  }

  const stopVoice = () => {
    setRecording(false)
    setTranscribing(true)
    setTimeout(() => {
      setTranscribing(false)
      setRawText(DEMO_TEXT[i18n.language as 'en' | 'hi'] ?? DEMO_TEXT.en)
    }, 1400)
  }

  const handleFile = () => {
    setFileName('SiteDiary_Day48.pdf')
    setExtracting(true)
    setTimeout(() => {
      setExtracting(false)
      setRawText(FILE_TEXT[i18n.language as 'en' | 'hi'] ?? FILE_TEXT.en)
    }, 1200)
  }

  const updateEntryStatus = (tempId: string, status: ActivityStatus) => {
    setEntries((prev) =>
      prev.map((e) => (e.tempId === tempId ? { ...e, status, delayReason: status === 'DELAYED' ? e.delayReason ?? 'OTHER' : null } : e))
    )
  }

  const updateDelayReason = (tempId: string, reason: DelayReasonCode) => {
    setEntries((prev) => prev.map((e) => (e.tempId === tempId ? { ...e, delayReason: reason } : e)))
  }

  const removeEntry = (tempId: string) => {
    setEntries((prev) => prev.filter((e) => e.tempId !== tempId))
  }

  const autoCount = entries.filter((e) => e.band === 'AUTO').length
  const reviewCount = entries.filter((e) => e.band === 'REVIEW').length
  const unmatchedCount = entries.filter((e) => e.band === 'UNMATCHED').length

  if (submitted) {
    return (
      <div className="mx-auto max-w-2xl text-center">
        <Card>
          <CardBody>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icon name="check" size={24} />
            </div>
            <h2 className="text-lg font-semibold text-slate-900">{t('sup.report.submittedTitle')}</h2>
            <div className="mt-3 flex justify-center gap-2 text-sm">
              {autoCount > 0 && <Chip color="emerald">{t('sup.report.autoCount', { n: autoCount })}</Chip>}
              {reviewCount > 0 && <Chip color="amber">{t('sup.report.reviewCount', { n: reviewCount })}</Chip>}
              {unmatchedCount > 0 && <Chip color="rose">{t('sup.report.unmatchedCount', { n: unmatchedCount })}</Chip>}
            </div>
            {reallocations.length > 0 && (
              <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-left">
                <div className="text-sm font-semibold text-blue-900">{t('worker.reallocationTitle')}</div>
                <div className="mt-2 space-y-1 text-xs text-blue-800">
                  {reallocations.map((item) => (
                    <div key={`${item.activityId}-${item.fromWorkerId}`}>
                      {item.activityName}: {item.fromWorkerId} → {item.toWorkerId ?? t('worker.unallocated')}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-5 flex justify-center gap-2">
              <Button variant="secondary" onClick={() => { setSubmitted(false); setEntries([]); setRawText(''); setFileName(''); setAbsentWorkerIds([]); setAbsenceReason(''); setReallocations([]) }}>{t('sup.report.reportMore')}</Button>
              <Button variant="primary" onClick={() => navigate('/s/history')}>{t('sup.report.viewHistory')}</Button>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('sup.report.title')} />
      <Card>
        <CardBody>
          <SegmentedTabs
            tabs={[
              { key: 'text', label: t('sup.report.textTab') },
              { key: 'voice', label: t('sup.report.voiceTab') },
              { key: 'file', label: t('sup.report.fileTab') },
            ]}
            active={tab}
            onChange={(k) => setTab(k as 'text' | 'voice' | 'file')}
          />

          <div className="mt-4">
            {tab === 'text' && (
              <>
                <Textarea
                  rows={5}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder={t('sup.report.placeholder')}
                />
                <p className="mt-1 text-xs text-slate-500">{t('sup.report.hint')}</p>
              </>
            )}

            {tab === 'voice' && (
              <div className="py-6 text-center">
                {!recording && !transcribing && !rawText && (
                  <>
                    <button onClick={startVoice} className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700">
                      <Icon name="mic" size={28} />
                    </button>
                    <p className="mt-3 text-sm text-slate-600">{t('sup.report.voiceIntro')}</p>
                  </>
                )}
                {recording && (
                  <div className="space-y-3">
                    <div className="flex h-12 items-end justify-center gap-1">
                      {[...Array(12)].map((_, i) => (
                        <div
                          key={i}
                          className="w-1.5 animate-[wave_1s_ease-in-out_infinite] rounded-full bg-brand-500"
                          style={{ height: '30%', animationDelay: `${i * 0.08}s` }}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-medium text-slate-700">{t('sup.report.recording')}</p>
                    <Button variant="danger" onClick={stopVoice}>{t('sup.report.stopTranscribe')}</Button>
                  </div>
                )}
                {transcribing && (
                  <div className="text-sm text-slate-600">{t('sup.report.transcribing')}</div>
                )}
                {rawText && (
                  <div className="rounded border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-700">{rawText}</div>
                )}
              </div>
            )}

            {tab === 'file' && (
              <div className="py-4 text-center">
                {!fileName && !extracting && !rawText && (
                  <>
                    <div className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-6">
                      <Icon name="fileText" size={32} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm text-slate-600">{t('sup.report.fileIntro')}</p>
                    </div>
                    <Button variant="secondary" className="mt-3" onClick={handleFile}>{t('wizard.useSample')}</Button>
                  </>
                )}
                {extracting && <div className="text-sm text-slate-600">{t('sup.report.extracting')}</div>}
                {rawText && (
                  <div className="text-left">
                    <div className="mb-1 text-xs text-slate-500">{t('sup.report.extractedText')}</div>
                    <Textarea rows={4} value={rawText} onChange={(e) => setRawText(e.target.value)} />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="primary" onClick={analyze} loading={analyzing} disabled={!rawText.trim() || !activeProjectId}>
              {analyzing ? t('sup.report.analyzing') : t('sup.report.analyze')}
            </Button>
          </div>

          {workers.length > 0 && (
            <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-800">{t('worker.attendanceForReport')}</div>
              <div className="mt-1 text-xs text-slate-500">{t('worker.attendanceForReportHint')}</div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {workers.map((worker) => (
                  <label key={worker.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={absentWorkerIds.includes(worker.id)}
                      onChange={() => setAbsentWorkerIds((current) => current.includes(worker.id) ? current.filter((id) => id !== worker.id) : [...current, worker.id])}
                    />
                    <span>{worker.name} · {worker.discipline}</span>
                  </label>
                ))}
              </div>
              {absentWorkerIds.length > 0 && (
                <input value={absenceReason} onChange={(e) => setAbsenceReason(e.target.value)} placeholder={t('worker.reasonPlaceholder')} className="mt-2 w-full rounded border border-slate-300 px-2 py-2 text-xs" />
              )}
            </div>
          )}

          {entries.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">{t('sup.report.simulatedTitle')}</div>
                <SimulatedAiTag />
              </div>
              <div className="mb-3 text-[10px] text-slate-500">{t('sup.report.aiLegend')}</div>
              <div className="space-y-3">
                {entries.map((entry) => (
                  <div key={entry.tempId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <BandChip band={entry.band} />
                        <ConfidenceMeter value={entry.confidence} band={entry.band} />
                      </div>
                      <button onClick={() => removeEntry(entry.tempId)} className="text-slate-400 hover:text-rose-600">
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                    <div className="mb-2 text-sm italic text-slate-700">"{entry.extractedText}"</div>
                    {entry.matchedActivityId ? (
                      <div className="mb-2 flex items-center gap-2 rounded bg-white p-2 text-sm">
                        <DisciplineChip discipline={entry.candidates.find((c) => c.activityId === entry.matchedActivityId)?.discipline ?? null} />
                        <div>
                          <div className="font-medium text-slate-800">{entry.matchedActivityName}</div>
                          <div className="font-mono text-[10px] text-slate-500">{entry.matchedActivityId}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-700">{t('sup.report.noMatch')}</div>
                    )}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-[10px] text-slate-500">{t('common.status')}</label>
                        <Select value={entry.status ?? ''} onChange={(e) => updateEntryStatus(entry.tempId, e.target.value as ActivityStatus)}>
                          {(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'ON_HOLD'] as ActivityStatus[]).map((s) => (
                            <option key={s} value={s}>{t(`status.${s}`)}</option>
                          ))}
                        </Select>
                      </div>
                      {entry.status === 'DELAYED' && (
                        <div>
                          <label className="text-[10px] text-slate-500">{t('delays.reason')}</label>
                          <Select value={entry.delayReason ?? 'OTHER'} onChange={(e) => updateDelayReason(entry.tempId, e.target.value as DelayReasonCode)}>
                            {DELAY_REASONS.map((r) => (
                              <option key={r} value={r}>{t(`delayReason.${r}`)}</option>
                            ))}
                          </Select>
                        </div>
                      )}
                    </div>
                    {entry.keywords.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {entry.keywords.map((k) => (
                          <span key={k} className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600">{k}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button variant="primary" onClick={submit}>{t('sup.report.submit')}</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {todayReports.length > 0 && (
        <Card className="mt-4">
          <CardBody>
            <div className="mb-2 text-sm font-semibold text-slate-800">{t('sup.report.todaySubmitted')}</div>
            <div className="space-y-2">
              {todayReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded border border-slate-100 p-2 text-sm">
                  <span>{t(`common.sources.${r.source}`)} · {r.entries.length} {t('sup.history.entries')}</span>
                  <TimeAgo iso={r.submittedAt} />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
