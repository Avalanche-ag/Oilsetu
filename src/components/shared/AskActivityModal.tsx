import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Modal, Button } from '../ui'
import { Textarea } from '../ui/Form'
import { ActivityPickerModal } from './ActivityPickerModal'
import { getActivities, getUsers, askQuestion } from '../../services/api'
import { useToast } from '../../store/toast'


export function AskActivityModal({
  open,
  onClose,
  projectId,
  preselectedActivityId,
}: {
  open: boolean
  onClose: () => void
  projectId: string
  preselectedActivityId?: string
}) {
  const { t } = useTranslation()
  const [activityId, setActivityId] = useState(preselectedActivityId)
  const [text, setText] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const push = useToast((s) => s.push)

  const { data: activities = [] } = useQuery({ queryKey: ['activities', projectId], queryFn: () => getActivities(projectId) })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const activity = useMemo(() => activities.find((a) => a.id === activityId), [activities, activityId])
  const supervisorId = activity?.assigneeId

  const handleSubmit = async () => {
    if (!activityId || !supervisorId || !text.trim()) return
    setSubmitting(true)
    await askQuestion(projectId, activityId, supervisorId, 'u-mgr-01', text.trim())
    push(t('toast.questionSent'), 'success')
    setSubmitting(false)
    setText('')
    onClose()
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>
        {t('common.cancel')}
      </Button>
      <Button variant="primary" onClick={handleSubmit} loading={submitting} disabled={!activityId || !text.trim()}>
        {t('messages.send')}
      </Button>
    </>
  )

  return (
    <>
      <Modal open={open} onClose={onClose} title={t('messages.newQuestion')} footer={footer}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('common.activity')}</label>
            {activity ? (
              <div className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-800">{activity.name}</div>
                  <div className="font-mono text-[10px] text-slate-500">{activity.id}</div>
                </div>
                <button onClick={() => setPickerOpen(true)} className="text-xs font-medium text-brand-600 hover:underline">
                  {t('common.edit')}
                </button>
              </div>
            ) : (
              <button onClick={() => setPickerOpen(true)} className="w-full rounded border border-dashed border-slate-300 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                {t('explorer.selectActivity')}
              </button>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('common.supervisor')}</label>
            <div className="text-sm text-slate-700">
              {supervisorId ? users.find((u) => u.id === supervisorId)?.name ?? '—' : t('explorer.assignFirst')}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">{t('messages.typeMessage')}</label>
            <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('recon.questionPlaceholder')} />
          </div>
        </div>
      </Modal>
      <ActivityPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projectId={projectId}
        title={t('explorer.selectActivity')}
        onSelect={(a) => {
          setActivityId(a.id)
          setPickerOpen(false)
        }}
      />
    </>
  )
}
