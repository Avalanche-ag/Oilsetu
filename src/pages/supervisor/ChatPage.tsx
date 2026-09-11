import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { getSupervisorThreads, getUser, getActivity } from '../../services/api'
import { PageHeader, Card, Avatar, StatusChip, TimeAgo } from '../../components/ui'
import { ThreadConversation } from '../../components/shared/ThreadConversation'
import type { ConversationThread } from '../../types/domain'

export function ChatPage() {
  const { t } = useTranslation()
  const userId = useAuth((s) => s.userId)
  const [selected, setSelected] = useState<ConversationThread | null>(null)
  const { data: threads = [], refetch } = useQuery({ queryKey: ['supThreads', userId], queryFn: () => getSupervisorThreads(userId || ''), enabled: Boolean(userId) })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t('sup.chat.title')} />
      {threads.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-500">{t('sup.chat.noQuestions')}</div>
      ) : (
        <Card className="grid min-h-[28rem] md:grid-cols-3">
          <div className="border-b border-slate-200 md:border-b-0 md:border-r">
            <div className="max-h-[28rem] overflow-y-auto">
              {threads.map((thread) => (
                <ThreadListItem key={thread.id} thread={thread} selected={selected?.id === thread.id} onClick={() => setSelected(thread)} />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            {selected ? (
              <ThreadConversation thread={selected} currentUserId={userId || ''} onUpdate={() => refetch()} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-slate-500">{t('messages.selectThread')}</div>
            )}
          </div>
        </Card>
      )}
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
