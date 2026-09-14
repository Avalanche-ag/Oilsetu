import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../store/auth'
import { Icon, Avatar } from '../ui'
import { LanguageToggle } from '../shared/LanguageToggle'

export function WorkerLayout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const user = useAuth((s) => s.user)
  const logout = useAuth((s) => s.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
            <Icon name="work" size={18} />
          </div>
          <div>
            <div className="text-xs text-slate-500">{t('worker.portal')}</div>
            <div className="text-sm font-semibold text-slate-800">{user?.name}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <div className="group relative">
            <button className="rounded-full p-1 hover:bg-slate-100" aria-label={t('common.account')}>
              <Avatar initials={user?.avatarInitials ?? 'W'} size="sm" />
            </button>
            <div className="absolute right-0 top-full z-20 mt-1 hidden w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg group-hover:block">
              <button onClick={handleLogout} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                <Icon name="logout" size={14} />
                {t('common.signOut')}
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4 lg:p-6">
        <Outlet />
      </main>
    </div>
  )
}
