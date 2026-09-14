import { useState, useEffect } from 'react'
import { NavLink, useNavigate, Outlet } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { useUi } from '../../store/ui'
import { getDashboard, getProjects, resetDemo } from '../../services/api'
import { Icon } from '../ui/Icon'
import { LanguageToggle } from '../shared/LanguageToggle'
import { Avatar } from '../ui/Avatar'
import { ConfirmModal } from '../ui/Modal'
import { useToast } from '../../store/toast'

const MANAGER_NAV = [
  { key: 'dashboard', to: '/m/dashboard', icon: 'dashboard' as const },
  { key: 'projects', to: '/m/projects', icon: 'projects' as const },
  { key: 'schedule', to: '/m/schedule', icon: 'schedule' as const },
  { key: 'assignments', to: '/m/assignments', icon: 'assignments' as const },
  { key: 'reconciliation', to: '/m/reconciliation', icon: 'reconciliation' as const },
  { key: 'delays', to: '/m/delays', icon: 'delays' as const },
  { key: 'messages', to: '/m/messages', icon: 'messages' as const },
  { key: 'audit', to: '/m/audit', icon: 'audit' as const },
  { key: 'insights', to: '/m/insights', icon: 'insights' as const },
]

export function ManagerLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const logout = useAuth((s) => s.logout)
  const user = useAuth((s) => s.user)
  const ready = useAuth((s) => s.ready)
  const boot = useAuth((s) => s.boot)
  const activeProjectId = useUi((s) => s.activeProjectId)
  const setActiveProjectId = useUi((s) => s.setActiveProjectId)
  const [resetOpen, setResetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const push = useToast((s) => s.push)

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: getProjects })
  const { data: dashboard } = useQuery({
    queryKey: ['dashboard', activeProjectId],
    queryFn: () => getDashboard(activeProjectId || ''),
    enabled: Boolean(activeProjectId),
  })

  const currentProject = projects.find((p) => p.id === activeProjectId) ?? projects[0]

  useEffect(() => {
    boot()
  }, [boot])

  useEffect(() => {
    if (currentProject && currentProject.id !== activeProjectId) {
      setActiveProjectId(currentProject.id)
    }
  }, [activeProjectId, currentProject, setActiveProjectId])

  const badgeCounts: Record<string, number | undefined> = {
    reconciliation: dashboard?.pendingReviews,
    delays: dashboard?.openDelays,
    messages: dashboard?.awaitingReply,
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleReset = async () => {
    await resetDemo()
    setResetOpen(false)
    push(t('toast.demoReset'), 'success')
    navigate('/login')
    window.location.reload()
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-sm font-medium text-slate-500">{t('common.loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-slate-100">
      <aside className={`fixed inset-y-0 left-0 z-30 w-60 transform bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center gap-2 border-b border-slate-800 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
            <Icon name="link" size={18} />
          </div>
          <span className="text-lg font-bold text-white">{t('app.name')}</span>
        </div>
        <nav className="space-y-1 p-3">
          {MANAGER_NAV.map((item) => (
            <NavLink
              key={item.key}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon name={item.icon} size={18} />
                {t(`nav.${item.key}`)}
              </div>
              {badgeCounts[item.key] ? (
                <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{badgeCounts[item.key]}</span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-slate-800 p-3 text-[10px] text-slate-500">
          {t('common.demoBuild')}
        </div>
      </aside>

      {menuOpen && <div className="fixed inset-0 z-20 bg-slate-900/50 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setMenuOpen(true)} className="rounded p-1 text-slate-500 hover:bg-slate-100 lg:hidden">
              <Icon name="menu" size={20} />
            </button>
            <select
              className="max-w-[12rem] rounded border border-slate-300 bg-slate-50 px-2 py-1 text-sm font-medium text-slate-800 focus:border-brand-500 focus:outline-none"
              value={activeProjectId ?? ''}
              onChange={(e) => setActiveProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <div className="hidden h-6 w-px bg-slate-200 sm:block" />
            <div className="relative group">
              <button className="flex items-center gap-2 rounded-full p-1 hover:bg-slate-100">
                <Avatar initials={user?.avatarInitials ?? 'U'} size="sm" />
                <span className="hidden text-sm font-medium text-slate-700 sm:inline">{user?.name}</span>
                <Icon name="chevronDown" size={14} className="text-slate-400" />
              </button>
              <div className="absolute right-0 top-full mt-1 hidden w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover:block">
                <div className="px-3 py-2 text-xs text-slate-500">{user?.designation}</div>
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
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

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
