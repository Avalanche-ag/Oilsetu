import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useUi } from '../../store/ui'
import { getThreads, getUser, getActivity } from '../../services/api'
import { PageHeader, Card, Button, Avatar, StatusChip, TimeAgo } from '../../components/ui'
import { ThreadConversation } from '../../components/shared/ThreadConversation'
import { AskActivityModal } from '../../components/shared/AskActivityModal'
import type { ConversationThread } from '../../types/domain'

export function MessagesPage() {
  const { t } = useTranslation()
  const activeProjectId = useUi((s) => s.activeProjectId)
  const [selected, setSelected] = useState<ConversationThread | null>(null)
  const [askOpen, setAskOpen] = useState(false)
  const { data: threads = [], refetch } = useQuery({ queryKey: ['threads', activeProjectId], queryFn: () => getThreads(activeProjectId || '') })

  return (
    <div>
      <PageHeader title={t('messages.title')} subtitle={t('messages.subtitle')} action={<Button variant="primary" icon="plus" onClick={() => setAskOpen(true)}>{t('messages.newQuestion')}</Button>} />
      <Card className="grid min-h-[32rem] lg:grid-cols-3">
        <div className="border-b border-slate-200 lg:border-b-0 lg:border-r">
          <div className="p-3">
            <div className="text-xs font-medium uppercase text-slate-500">{t('messages.threads')}</div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {threads.length === 0 && <div className="p-4 text-center text-sm text-slate-500">{t('messages.noThreads')}</div>}
            {threads.map((thread) => (
              <ThreadListItem key={thread.id} thread={thread} selected={selected?.id === thread.id} onClick={() => setSelected(thread)} />
            ))}
          </div>
        </div>
        <div className="lg:col-span-2">
          {selected ? (
            <ThreadConversation thread={selected} currentUserId="u-mgr-01" onUpdate={() => refetch()} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-500">{t('messages.selectThread')}</div>
          )}
        </div>
      </Card>
      <AskActivityModal open={askOpen} onClose={() => setAskOpen(false)} projectId={activeProjectId || ''} />
    </div>
  )
}

function ThreadListItem({ thread, selected, onClick }: { thread: ConversationThread; selected: boolean; onClick: () => void }) {
  const activity = thread.activityId ? getActivity(thread.projectId, thread.activityId) : undefined
  const supervisor = getUser(thread.supervisorId)
  const last = thread.messages[thread.messages.length - 1]
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-start gap-2 border-b border-slate-100 p-3 text-left transition-colors hover:bg-slate-50 ${selected ? 'bg-brand-50' : ''}`}
    >
      <Avatar initials={supervisor?.avatarInitials ?? '?'} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <span className="truncate text-sm font-medium text-slate-800">{activity?.name ?? thread.subject}</span>
          <StatusChip status={thread.status === 'OPEN' ? 'IN_PROGRESS' : 'COMPLETED'} />
        </div>
        <div className="truncate text-xs text-slate-500">{last?.text}</div>
        <div className="mt-0.5 text-[10px] text-slate-400">
          <TimeAgo iso={last?.sentAt} />
        </div>
      </div>
    </button>
  )
}
