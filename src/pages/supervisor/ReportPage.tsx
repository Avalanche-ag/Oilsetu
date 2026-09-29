import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { aiService, submitReport, getSupervisorReports, getWorkers, getActivities, uploadVisualProof, verifyVisualProof } from '../../services/api'
import type { PipelineRiskInsight, VisualProofResult } from '../../services/api'
import { todayIso } from '../../utils/dates'
import { PageHeader, Card, CardBody, Button, SegmentedTabs, Textarea, Select, BandChip, ConfidenceMeter, Chip, SimulatedAiTag, TimeAgo, Icon } from '../../components/ui'
import { DisciplineChip } from '../../components/ui/DisciplineChip'
import { useToast } from '../../store/toast'
import type { PreviewEntry, ActivityStatus, DelayReasonCode, ReallocationResult, ReportSource } from '../../types/domain'
import { DELAY_REASONS } from '../../config/constants'

export function ReportPage() {
  const { t, i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const qc = useQueryClient()
  const push = useToast((s) => s.push)
  const navigate = useNavigate()
  const [tab, setTab] = useState<'text' | 'voice' | 'file' | 'photo'>('text')
  const [rawText, setRawText] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [entries, setEntries] = useState<PreviewEntry[]>([])
  const [risks, setRisks] = useState<PipelineRiskInsight[]>([])
  const [reportSource, setReportSource] = useState<ReportSource>('TEXT')
  const [submitted, setSubmitted] = useState(false)
  const [recording, setRecording] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [fileName, setFileName] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [absentWorkerIds, setAbsentWorkerIds] = useState<string[]>([])
  const [absenceReason, setAbsenceReason] = useState('')
  const [reallocations, setReallocations] = useState<ReallocationResult[]>([])
  const [photoActivityId, setPhotoActivityId] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoResult, setPhotoResult] = useState<VisualProofResult | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)

  const { data: reports = [] } = useQuery({ queryKey: ['supReports', userId], queryFn: () => getSupervisorReports(userId || ''), enabled: Boolean(userId) })
  const { data: workers = [] } = useQuery({ queryKey: ['workers', activeProjectId], queryFn: () => getWorkers(activeProjectId || '', todayIso()), enabled: Boolean(activeProjectId) })
  const { data: activities = [] } = useQuery({ queryKey: ['activities', activeProjectId], queryFn: () => getActivities(activeProjectId || ''), enabled: Boolean(activeProjectId) })
  const l6Activities = activities.filter((a) => a.level === 'L6')
  const todayReports = reports.filter((r) => r.reportDate === todayIso())

  const analyze = async () => {
    if (!rawText.trim() || !activeProjectId || !userId) return
    setAnalyzing(true)
    try {
      const run = await aiService.runPipeline({ kind: 'text', text: rawText.trim() }, {
        projectId: activeProjectId,
        supervisorId: userId,
        source: 'TEXT',
        language: i18n.language,
      })
      setEntries(run.entries)
      setRisks(run.risks)
      setReportSource('TEXT')
    } catch {
      push(t('sup.report.pipelineFailed'), 'error')
    } finally {
      setAnalyzing(false)
    }
  }

  const submit = async () => {
    if (!activeProjectId || !userId || entries.length === 0) return
    const result = await submitReport({
      projectId: activeProjectId,
      supervisorId: userId,
      source: reportSource,
      rawContent: rawText,
      fileName: reportSource === 'FILE' ? fileName || 'report.txt' : undefined,
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

  const startVoice = async () => {
    if (!activeProjectId || !userId) return
    if (typeof MediaRecorder === 'undefined') {
      push(t('sup.report.recordingUnsupported'), 'error')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : ''
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop())
        void processVoice(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
      setRawText('')
      setEntries([])
      setRisks([])
      setTranscribing(false)
    } catch {
      push(t('sup.report.micDenied'), 'error')
    }
  }

  const stopVoice = () => {
    setRecording(false)
    setTranscribing(true)
    mediaRecorderRef.current?.stop()
  }

  const processVoice = async (blob: Blob) => {
    if (!activeProjectId || !userId) {
      setTranscribing(false)
      return
    }
    try {
      const type = blob.type
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : 'webm'
      const run = await aiService.runPipeline(
        { kind: 'voice', blob, filename: `recording.${ext}` },
        { projectId: activeProjectId, supervisorId: userId, source: 'VOICE', language: i18n.language },
      )
      setRawText(run.extractedText)
      setEntries(run.entries)
      setRisks(run.risks)
      setReportSource('VOICE')
    } catch {
      push(t('sup.report.pipelineFailed'), 'error')
    } finally {
      setTranscribing(false)
    }
  }

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !activeProjectId || !userId) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.docx') && !lower.endsWith('.txt')) {
      push(t('sup.report.fileUnsupported'), 'error')
      return
    }
    setFileName(file.name)
    setExtracting(true)
    setRawText('')
    setEntries([])
    setRisks([])
    void (async () => {
      try {
        const run = await aiService.runPipeline(
          { kind: lower.endsWith('.docx') ? 'docx' : 'text', blob: file, filename: file.name },
          { projectId: activeProjectId, supervisorId: userId, source: 'FILE', language: i18n.language },
        )
        setRawText(run.extractedText)
        setEntries(run.entries)
        setRisks(run.risks)
        setReportSource('FILE')
      } catch {
        push(t('sup.report.pipelineFailed'), 'error')
        setFileName('')
      } finally {
        setExtracting(false)
      }
    })()
  }

  const handlePhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoFile(file)
    setPhotoResult(null)
  }

  const verifyPhoto = async () => {
    if (!photoFile || !photoActivityId) return
    setPhotoBusy(true)
    try {
      await uploadVisualProof(photoActivityId, photoFile)
      const result = await verifyVisualProof(photoActivityId)
      setPhotoResult(result)
      push(result.photo_verified ? t('sup.report.photoVerified') : t('sup.report.photoNotVerified'), result.photo_verified ? 'success' : 'error')
    } catch {
      push(t('sup.report.photoFailed'), 'error')
    } finally {
      setPhotoBusy(false)
    }
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
              <Button variant="secondary" onClick={() => { setSubmitted(false); setEntries([]); setRisks([]); setRawText(''); setFileName(''); setAbsentWorkerIds([]); setAbsenceReason(''); setReallocations([]); setReportSource('TEXT'); setPhotoFile(null); setPhotoResult(null); setPhotoActivityId('') }}>{t('sup.report.reportMore')}</Button>
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
              { key: 'photo', label: t('sup.report.photoTab') },
            ]}
            active={tab}
            onChange={(k) => setTab(k as 'text' | 'voice' | 'file' | 'photo')}
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
                      <p className="mt-1 text-xs text-slate-500">{t('sup.report.fileHint')}</p>
                    </div>
                    <input ref={fileInputRef} type="file" accept=".docx,.txt" className="hidden" onChange={handleFile} />
                    <Button variant="secondary" className="mt-3" onClick={() => fileInputRef.current?.click()}>{t('sup.report.fileChoose')}</Button>
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

            {tab === 'photo' && (
              <div className="py-4 text-left">
                <p className="mb-3 text-xs text-slate-500">{t('sup.report.photoIntro')}</p>
                <label className="text-[10px] text-slate-500">{t('sup.report.photoActivity')}</label>
                <Select value={photoActivityId} onChange={(e) => { setPhotoActivityId(e.target.value); setPhotoResult(null) }}>
                  <option value="">{t('sup.report.photoSelectActivity')}</option>
                  {l6Activities.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
                <div className="mt-3 flex items-center gap-2">
                  <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
                  <Button variant="secondary" onClick={() => photoInputRef.current?.click()}>{t('sup.report.photoChoose')}</Button>
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{photoFile?.name ?? ''}</span>
                </div>
                <div className="mt-3 flex justify-end">
                  <Button variant="primary" onClick={verifyPhoto} loading={photoBusy} disabled={!photoFile || !photoActivityId || photoBusy}>
                    {photoBusy ? t('sup.report.photoVerifying') : t('sup.report.photoVerify')}
                  </Button>
                </div>
                {photoResult && (
                  <div className={`mt-3 rounded-lg border p-3 ${photoResult.photo_verified ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-semibold ${photoResult.photo_verified ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {photoResult.photo_verified ? t('sup.report.photoVerified') : t('sup.report.photoNotVerified')}
                      </span>
                      <span className="text-xs text-slate-600">{t('sup.report.photoConfidence')}: {Math.round(photoResult.visual_match_confidence * 100)}%</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{photoResult.reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {tab !== 'photo' && (
            <div className="mt-4 flex justify-end">
              <Button variant="primary" onClick={analyze} loading={analyzing} disabled={!rawText.trim() || !activeProjectId}>
                {analyzing ? t('sup.report.analyzing') : t('sup.report.analyze')}
              </Button>
            </div>
          )}

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
              {risks.length > 0 && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left">
                  <div className="text-sm font-semibold text-amber-900">{t('sup.report.risksTitle')}</div>
                  <div className="mt-2 space-y-1.5">
                    {risks.map((r, i) => (
                      <div key={`${r.type}-${i}`} className="flex items-start gap-2 text-xs text-amber-900">
                        <span
                          className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${
                            r.severity === 'High' ? 'bg-rose-100 text-rose-700' : r.severity === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {r.severity}
                        </span>
                        <div>
                          <div>{r.message}</div>
                          {r.action && <div className="text-amber-700">{r.action}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                      <div className="mb-2 rounded bg-rose-50 p-2 text-xs text-rose-700">
                        {t('sup.report.noMatch')}
                        {entry.candidates[0] && (
                          <div className="mt-1 font-medium text-amber-700">{t('sup.report.noMatchSuggestion', { name: entry.candidates[0].name })}</div>
                        )}
                      </div>
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
