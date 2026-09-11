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
    <div className="flex min-h-screen bg-[#FAFAF8]">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-[#0A1830] p-10 text-white lg:flex lg:w-[46%]">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-[#0A1830] via-[#0E2140] to-[#0A1830]" />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,184,220,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,184,220,0.07) 1px, transparent 1px)',
            backgroundSize: '36px 36px',
          }}
        />
        <div aria-hidden className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-teal-400/10 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-brand-500/10 blur-3xl" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-teal-300/60 to-transparent" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-lg shadow-brand-950/40 ring-1 ring-white/20">
              <Icon name="link" size={22} />
            </div>
            <div className="text-[26px] font-semibold tracking-tight">{t('app.name')}</div>
          </div>
          <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-slate-300/90">{t('app.tagline')}</p>
        </div>
        <div className="relative space-y-3">
          <Feature icon="schedule" text="L1–L6 schedule explorer" />
          <Feature icon="reconciliation" text="AI-assisted reconciliation (simulated)" />
          <Feature icon="globe" text="English & Hindi interface" />
        </div>
        <div className="relative">
          <div className="mb-4 h-px bg-white/10" />
          <div className="text-xs text-slate-400">{t('common.demoBuild')}</div>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10 lg:p-14">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0E2140] text-white shadow-sm">
              <Icon name="link" size={18} />
            </div>
            <div className="leading-tight">
              <div className="text-xl font-semibold tracking-tight text-slate-900">{t('app.name')}</div>
              <p className="text-xs text-slate-500">{t('app.tagline')}</p>
            </div>
          </div>

          <div className="mb-8 flex justify-end">
            <LanguageToggle />
          </div>

          <div className="rounded-2xl border border-slate-900/[0.06] bg-white p-7 shadow-[0_24px_60px_-24px_rgba(10,24,48,0.25)] sm:p-8">
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">{t('login.title')}</h1>
            <p className="mt-1 text-sm text-slate-500">{t('login.subtitle')}</p>

            <div className="mt-6 space-y-3">
              {users.map((u) => {
                const isSelected = selected === u.id
                return (
                  <button
                    key={u.id}
                    onClick={() => setSelected(u.id)}
                    className={`group flex w-full items-center gap-3.5 rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                      isSelected
                        ? 'border-brand-600 bg-brand-50/70 shadow-[0_10px_24px_-12px_rgba(31,87,233,0.45)] ring-2 ring-brand-600/15'
                        : 'border-slate-200 bg-white hover:-translate-y-px hover:border-slate-300 hover:shadow-[0_10px_24px_-12px_rgba(10,24,48,0.25)]'
                    }`}
                  >
                    <Avatar initials={u.avatarInitials} className={isSelected ? 'ring-2 ring-brand-600/30' : ''} />
                    <div className="flex-1">
                      <div className="text-[15px] font-semibold text-slate-900">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.designation}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors duration-200 ${
                          isSelected ? 'bg-brand-100 text-brand-800' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {t(`roles.${u.role}`)}
                      </span>
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all duration-200 ${
                          isSelected
                            ? 'scale-100 border-brand-600 bg-brand-600 text-white opacity-100'
                            : 'scale-75 border-slate-200 text-transparent opacity-0'
                        }`}
                      >
                        <Icon name="check" size={12} />
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <Button variant="primary" className="mt-6 h-12 w-full text-[15px] font-semibold" disabled={!selected} onClick={handleLogin}>
              {t('common.signIn')}
            </Button>

            <p className="mt-4 text-center text-xs text-slate-500">{t('login.note')}</p>
          </div>

          <button
            onClick={() => setResetOpen(true)}
            className="mt-4 w-full text-center text-xs text-rose-600 transition-colors hover:text-rose-700 hover:underline"
          >
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
    <div className="flex items-center gap-3.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3.5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/10">
        <Icon name={icon} size={18} className="text-teal-200" />
      </div>
      <span className="text-sm font-medium text-slate-100">{text}</span>
    </div>
  )
}
