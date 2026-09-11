import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { getUser, getSupervisorThreads, resetDemo } from '../../services/api'
import { getDb } from '../../mocks/db'
import { Icon } from '../ui/Icon'
import { LanguageToggle } from '../shared/LanguageToggle'
import { Avatar } from '../ui/Avatar'
import { ConfirmModal } from '../ui/Modal'
import { useToast } from '../../store/toast'

const SUP_NAV = [
  { key: 'home', to: '/s/dashboard', icon: 'home' as const },
  { key: 'myWork', to: '/s/work', icon: 'work' as const },
  { key: 'report', to: '/s/report', icon: 'report' as const },
  { key: 'history', to: '/s/history', icon: 'history' as const },
  { key: 'chat', to: '/s/chat', icon: 'chat' as const },
]

export function SupervisorLayout() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuth((s) => s.logout)
  const userId = useAuth((s) => s.userId)
  const user = userId ? getUser(userId) : undefined
  const [resetOpen, setResetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const push = useToast((s) => s.push)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const setActiveProjectId = useUi((s) => s.setActiveProjectId)

  useEffect(() => {
    if (!activeProjectId) {
      const p = getDb().projects.find((p) => p.status === 'ACTIVE')
      if (p) setActiveProjectId(p.id)
    }
  }, [activeProjectId, setActiveProjectId])

  const { data: threads = [] } = useQuery({
    queryKey: ['supThreads', userId],
    queryFn: () => getSupervisorThreads(userId || ''),
    enabled: Boolean(userId),
  })

  const chatBadge = threads.filter((t) => t.status === 'OPEN' && t.messages[t.messages.length - 1]?.senderId !== userId).length

  const today = new Intl.DateTimeFormat(i18n.language === 'hi' ? 'hi-IN' : 'en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleReset = () => {
    resetDemo()
    setResetOpen(false)
    push(t('toast.demoReset'), 'success')
    navigate('/login')
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-100 pb-20">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
            <Icon name="link" size={18} />
          </div>
          <div className="leading-tight">
            <div className="text-xs font-medium text-slate-500">{today}</div>
            <div className="text-sm font-semibold text-slate-800">{t('sup.dashboard.greeting', { name: user?.name.split(' ')[0] ?? '' })}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
            <Avatar initials={user?.avatarInitials ?? 'U'} size="sm" />
          </button>
          {menuOpen && (
            <div className="absolute right-4 top-12 z-50 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
              <button onClick={() => setResetOpen(true)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50">
                <Icon name="refresh" size={14} />
                {t('common.resetDemo')}
              </button>
              <div className="my-1 h-px bg-slate-100" />
              <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                <Icon name="logout" size={14} />
                {t('common.signOut')}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 p-4">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white px-2 pb-safe pt-2">
        <div className="mx-auto flex max-w-md items-center justify-around">
          {SUP_NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              className={({ isActive }) =>
                `relative flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium ${
                  isActive ? 'text-brand-700' : 'text-slate-500'
                }`
              }
            >
              {item.key === 'report' ? (
                <div className="flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg">
                  <Icon name="report" size={24} />
                </div>
              ) : (
                <Icon name={item.icon} size={20} />
              )}
              <span className={item.key === 'report' ? '-translate-y-2' : ''}>{t(`nav.${item.key}`)}</span>
              {item.key === 'chat' && chatBadge > 0 && (
                <span className="absolute right-1 top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                  {chatBadge}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {menuOpen && <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />}

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title={t('common.resetDemo')}
        message={t('common.resetConfirm')}
        confirmText={t('common.reset')}
        cancelText={t('common.cancel')}
      />
    </div>
  )
}
