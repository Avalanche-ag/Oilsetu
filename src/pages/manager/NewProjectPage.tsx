import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProject, uploadSchedule } from '../../services/api'
import { useUi } from '../../store/ui'
import { PageHeader, Button, Card, CardHeader, CardBody, ProgressBar, Icon } from '../../components/ui'
import { Input } from '../../components/ui/Form'
import { DISCIPLINES } from '../../config/constants'
import { useToast } from '../../store/toast'
import type { Discipline } from '../../types/domain'

export function NewProjectPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const setActiveProjectId = useUi((s) => s.setActiveProjectId)
  const push = useToast((s) => s.push)

  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '',
    code: '',
    client: '',
    location: '',
    disciplines: [] as Discipline[],
    startDate: '',
    plannedEnd: '',
  })
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseProgress, setParseProgress] = useState(0)
  const [parseResult, setParseResult] = useState<{ activityCount: number; levelCounts: Record<string, number>; disciplines: string[] } | null>(null)

  const createMutation = useMutation({
    mutationFn: createProject,
    onSuccess: (project) => {
      setActiveProjectId(project.id)
      push(t('toast.projectCreated'), 'success')
    },
  })

  useEffect(() => {
    if (createMutation.isSuccess && step === 1) {
      setStep(2)
    }
  }, [createMutation.isSuccess, step])

  const canProceed = form.name && form.code && form.startDate && form.plannedEnd && form.disciplines.length > 0

  const handleUpload = async (file: File) => {
    setFileName(file.name)
    setParsing(true)
    setParseProgress(20)
    setTimeout(() => setParseProgress(50), 500)
    setTimeout(() => setParseProgress(80), 1100)
    const project = createMutation.data
    if (!project) return
    const result = await uploadSchedule(project.id, file)
    setParseProgress(100)
    setParseResult(result)
    setParsing(false)
    push(t('toast.scheduleUploaded'), 'success')
  }

  const finish = () => {
    qc.invalidateQueries()
    navigate('/m/schedule')
  }

  return (
    <div>
      <PageHeader title={t('wizard.title')} />
      <Card className="mx-auto max-w-3xl">
        <CardHeader title={`${t('wizard.step1')} → ${t('wizard.step2')}`} />
        <CardBody>
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.name')}</label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.code')}</label>
                  <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.client')}</label>
                  <Input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.location')}</label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.startDate')}</label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.plannedEnd')}</label>
                  <Input type="date" value={form.plannedEnd} onChange={(e) => setForm({ ...form, plannedEnd: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">{t('wizard.disciplines')}</label>
                <div className="flex flex-wrap gap-2">
                  {DISCIPLINES.map((d) => (
                    <button
                      key={d}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          disciplines: f.disciplines.includes(d) ? f.disciplines.filter((x) => x !== d) : [...f.disciplines, d],
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${
                        form.disciplines.includes(d)
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t(`discipline.${d}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="primary" disabled={!canProceed} onClick={() => createMutation.mutate(form)}>
                  {t('common.next')}
                </Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {!fileName && !parsing && !parseResult && (
                <div
                  className="rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const file = e.dataTransfer.files[0]
                    if (file) handleUpload(file)
                  }}
                >
                  <Icon name="upload" size={32} className="mx-auto mb-2 text-slate-400" />
                  <p className="text-sm text-slate-600">{t('wizard.dragDrop')}</p>
                  <div className="my-3 text-xs text-slate-400">{t('common.or')}</div>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      const input = document.createElement('input')
                      input.type = 'file'
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0]
                        if (file) handleUpload(file)
                      }
                      input.click()
                    }}
                  >
                    {t('common.upload')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleUpload(new File([], 'CDU3_Baseline_v1.xer'))}>
                    {t('wizard.useSample')}
                  </Button>
                  <p className="mt-3 text-[10px] text-slate-400">{t('wizard.uploadHint')}</p>
                </div>
              )}

              {parsing && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-700">{t('wizard.parseSummary')}</div>
                  <ProgressBar value={parseProgress} />
                  <div className="text-xs text-slate-500">
                    {parseProgress < 30 && t('wizard.parsingStep1')}
                    {parseProgress >= 30 && parseProgress < 55 && t('wizard.parsingStep2')}
                    {parseProgress >= 55 && parseProgress < 85 && t('wizard.parsingStep3')}
                    {parseProgress >= 85 && t('wizard.parsingStep4')}
                  </div>
                </div>
              )}

              {parseResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                    <Icon name="checkCircle" size={16} />
                    {t('wizard.parseSummary')}
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded bg-white p-2">
                      <div className="text-lg font-bold text-slate-800">{parseResult.activityCount}</div>
                      <div className="text-[10px] text-slate-500">{t('wizard.activitiesFound')}</div>
                    </div>
                    <div className="rounded bg-white p-2">
                      <div className="text-lg font-bold text-slate-800">{Object.keys(parseResult.levelCounts).length}</div>
                      <div className="text-[10px] text-slate-500">{t('wizard.levelsFound')}</div>
                    </div>
                    <div className="rounded bg-white p-2">
                      <div className="text-lg font-bold text-slate-800">{parseResult.disciplines.length}</div>
                      <div className="text-[10px] text-slate-500">{t('wizard.disciplinesFound')}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => navigate('/m/projects')}>
                  {t('common.cancel')}
                </Button>
                <Button variant="primary" disabled={!parseResult} onClick={finish}>
                  {t('wizard.finish')}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
