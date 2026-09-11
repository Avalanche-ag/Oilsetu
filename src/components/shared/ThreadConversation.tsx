import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getUser, getActivity, resolveThread, sendMessage } from '../../services/api'
import { Button } from '../ui/Button'
import { Textarea } from '../ui/Form'
import { Avatar } from '../ui/Avatar'
import { StatusChip } from '../ui/StatusChip'
import { TimeAgo } from '../ui/TimeAgo'
import type { ConversationThread } from '../../types/domain'

export function ThreadConversation({
  thread,
  currentUserId,
  onUpdate,
}: {
  thread: ConversationThread
  currentUserId: string
  onUpdate?: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const activity = thread.activityId ? getActivity(thread.projectId, thread.activityId) : undefined
  const supervisor = getUser(thread.supervisorId)

  const handleSend = async () => {
    if (!text.trim()) return
    setSending(true)
    await sendMessage(thread.id, currentUserId, text.trim())
    setSending(false)
    setText('')
    onUpdate?.()
  }

  const handleResolve = async () => {
    await resolveThread(thread.id, currentUserId)
    onUpdate?.()
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            {activity ? (
              <div className="text-sm font-semibold text-slate-800">
                {t('messages.about')} <span className="font-mono text-brand-700">{activity.id}</span>
              </div>
            ) : (
              <div className="text-sm font-semibold text-slate-800">{thread.subject}</div>
            )}
            <div className="text-xs text-slate-500">
              {t('messages.threadWith')} {supervisor?.name}
            </div>
          </div>
          <button
            onClick={handleResolve}
            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            {thread.status === 'RESOLVED' ? t('messages.reopen') : t('messages.markResolved')}
          </button>
        </div>
        {activity && (
          <div className="mt-2 flex items-center gap-2">
            <StatusChip status={activity.status} />
            <span className="text-xs text-slate-500">{activity.name}</span>
          </div>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {thread.messages.map((msg) => {
          const isMe = msg.senderId === currentUserId
          const sender = getUser(msg.senderId)
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-[80%] gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                <Avatar initials={sender?.avatarInitials ?? '?'} size="sm" />
                <div>
                  <div
                    className={`rounded-lg px-3 py-2 text-sm ${
                      isMe ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <div className={`mt-0.5 text-[10px] text-slate-400 ${isMe ? 'text-right' : 'text-left'}`}>
                    {sender?.name} · <TimeAgo iso={msg.sentAt} />
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-slate-100 p-3">
        <div className="flex items-end gap-2">
          <Textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('messages.typeMessage')}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
          />
          <Button variant="primary" onClick={handleSend} loading={sending} icon="send" />
        </div>
      </div>
    </div>
  )
}
