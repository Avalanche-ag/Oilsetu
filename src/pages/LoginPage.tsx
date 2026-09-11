import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { getUsers, updateUserLanguage, resetDemo } from '../services/api'
import { LanguageToggle } from '../components/shared/LanguageToggle'
import { Button, Avatar, Icon } from '../components/ui'
import { ConfirmModal } from '../components/ui/Modal'

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)
  const [selected, setSelected] = useState<string | null>(null)
  const [users, setUsers] = useState<{ id: string; name: string; role: 'manager' | 'supervisor'; designation: string; avatarInitials: string }[]>([])
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    getUsers().then(setUsers)
  }, [])

  const handleLogin = () => {
    if (!selected) return
    const user = users.find((u) => u.id === selected)
    if (!user) return
    login(selected)
    i18n.changeLanguage(user.role === 'manager' ? 'en' : i18n.language)
    updateUserLanguage(selected, i18n.language as 'en' | 'hi')
    navigate(user.role === 'manager' ? '/m/dashboard' : '/s/dashboard')
  }

  const handleReset = () => {
    resetDemo()
    setResetOpen(false)
    window.location.reload()
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-col justify-between bg-slate-900 p-8 text-white lg:flex lg:w-1/2">
        <div>
          <div className="flex items-center gap-2 text-2xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded bg-brand-600">
              <Icon name="link" size={22} />
            </div>
            {t('app.name')}
          </div>
          <p className="mt-2 text-slate-300">{t('app.tagline')}</p>
        </div>
        <div className="space-y-4">
          <Feature icon="schedule" text="L1–L6 schedule explorer" />
          <Feature icon="reconciliation" text="AI-assisted reconciliation (simulated)" />
          <Feature icon="globe" text="English & Hindi interface" />
        </div>
        <div className="text-xs text-slate-500">{t('common.demoBuild')}</div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center lg:hidden">
            <div className="text-2xl font-bold text-slate-900">{t('app.name')}</div>
            <p className="text-sm text-slate-500">{t('app.tagline')}</p>
          </div>

          <div className="mb-6 flex justify-end">
            <LanguageToggle />
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">{t('login.title')}</h1>
            <p className="text-sm text-slate-500">{t('login.subtitle')}</p>

            <div className="mt-5 space-y-3">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelected(u.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected === u.id ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Avatar initials={u.avatarInitials} />
                  <div className="flex-1">
                    <div className="font-medium text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.designation}</div>
                  </div>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase text-slate-600">{t(`roles.${u.role}`)}</span>
                </button>
              ))}
            </div>

            <Button variant="primary" className="mt-5 w-full" disabled={!selected} onClick={handleLogin}>
              {t('common.signIn')}
            </Button>

            <p className="mt-4 text-center text-xs text-slate-400">{t('login.note')}</p>
          </div>

          <button onClick={() => setResetOpen(true)} className="mt-4 w-full text-center text-xs text-rose-600 hover:underline">
            {t('login.resetLink')}
          </button>
        </div>
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

function Feature({ icon, text }: { icon: 'schedule' | 'reconciliation' | 'globe'; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon name={icon} size={20} className="text-brand-400" />
      <span className="text-sm text-slate-200">{text}</span>
    </div>
  )
}
