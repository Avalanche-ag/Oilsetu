import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/auth'
import { useToast } from '../store/toast'
import { ApiError, getAuthToken, getUsers, loginAsDemo, loginWithPassword, updateUserLanguage, resetDemo } from '../services/api'
import { LanguageToggle } from '../components/shared/LanguageToggle'
import { ConfirmModal } from '../components/ui/Modal'
import oilsiteBg from '../assets/oilsite.jpg'

interface DemoUser {
  id: string
  name: string
  role: 'manager' | 'supervisor' | 'worker'
  designation: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const setSession = useAuth((s) => s.setSession)
  const logout = useAuth((s) => s.logout)
  const pushToast = useToast((s) => s.push)
  const [users, setUsers] = useState<DemoUser[]>([])
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)

  useEffect(() => {
    getUsers().then(setUsers).catch(() => setUsers([]))
  }, [])

  useEffect(() => {
    if (!getAuthToken()) logout()
  }, [logout])

  const loginAs = async (user: DemoUser) => {
    try {
      const { token, user: u } = await loginAsDemo(user.id)
      setSession(u, token)
      i18n.changeLanguage(u.role === 'manager' ? 'en' : i18n.language)
      updateUserLanguage(u.id, i18n.language as 'en' | 'hi')
      navigate(u.role === 'manager' ? '/m/dashboard' : u.role === 'supervisor' ? '/s/dashboard' : '/w/dashboard')
    } catch {
      pushToast(t('login.errNoServer'), 'error')
    }
  }

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email.trim() === '' || password === '') {
      pushToast(t('login.errEmptyFields'), 'error')
      return
    }
    if (!EMAIL_RE.test(email.trim())) {
      pushToast(t('login.errBadEmail'), 'error')
      return
    }
    try {
      const { token, user: u } = await loginWithPassword(email.trim(), password)
      setSession(u, token)
      i18n.changeLanguage(u.role === 'manager' ? 'en' : i18n.language)
      updateUserLanguage(u.id, i18n.language as 'en' | 'hi')
      navigate(u.role === 'manager' ? '/m/dashboard' : u.role === 'supervisor' ? '/s/dashboard' : '/w/dashboard')
    } catch (err) {
      pushToast(err instanceof ApiError && err.status === 401 ? t('login.errBadCredentials') : t('login.errNoServer'), 'error')
    }
  }

  const handleReset = async () => {
    try {
      await resetDemo()
    } catch {
      pushToast(t('login.errNoServer'), 'error')
      return
    }
    setResetOpen(false)
    window.location.reload()
  }

  const brandTagline = t('login.brandTagline', { returnObjects: true })
  const brandLines = Array.isArray(brandTagline) ? brandTagline : [String(brandTagline)]
  const supervisors = users.filter((u) => u.role === 'supervisor')
  const planners = users.filter((u) => u.role === 'manager')
  const workers = users.filter((u) => u.role === 'worker')

  return (
    <main
      className="relative flex min-h-screen flex-col bg-[#071a2c] bg-cover bg-center bg-no-repeat text-[#102a43]"
      style={{ backgroundImage: `url(${oilsiteBg})` }}
    >
      <div aria-hidden className="absolute inset-0 bg-[rgba(8,30,45,0.28)]" />

      <header className="relative z-[2] flex items-start justify-between px-[20px] py-[15px] min-[700px]:px-[45px] min-[700px]:py-[22px]">
        <div className="flex items-center gap-3 text-white">
          <div className="relative h-[60px] w-[46px]">
            <div className="h-[42px] w-[42px] rounded-full border-[7px] border-[#111111] bg-transparent" />
            <div className="absolute left-[14px] top-[39px] h-[25px] w-[14px] bg-[#e52b25]" />
          </div>
          <div className="leading-[1.1]">
            <div className="text-[14px] font-semibold">ऑयल इंडिया</div>
            <div className="text-[19px] font-extrabold tracking-[1px]">OIL INDIA</div>
          </div>
          <div className="mx-1 h-[48px] w-px bg-[rgba(255,255,255,0.75)]" />
          <div className="hidden text-[9px] leading-[1.3] tracking-[1px] min-[700px]:block">
            {brandLines.map((line) => (
              <span key={line} className="block">{line}</span>
            ))}
          </div>
        </div>
        <LanguageToggle tone="dark" />
      </header>

      <section className="relative z-[2] flex flex-col items-center justify-start pb-[10px]">
        <div className="mb-[14px] px-[15px] text-center text-white [text-shadow:0_2px_8px_rgba(0,0,0,0.35)] min-[700px]:px-0">
          <p className="mb-[1px] text-[17px]">{t('login.welcome')}</p>
          <h1 className="text-[36px] font-extrabold leading-[1.05] tracking-[-1px] min-[700px]:text-[44px]">{t('login.appName')}</h1>
          <p className="mt-[7px] text-[16px] font-semibold min-[700px]:text-[20px]">{t('login.heroTagline')}</p>
          <p className="mt-[5px] text-[11px] tracking-[0.3px] min-[700px]:text-[13px]">{t('login.heroSub')}</p>
        </div>

        <div className="w-[calc(100%-30px)] rounded-[15px] bg-[rgba(255,255,255,0.96)] px-[20px] py-[22px] shadow-[0_15px_40px_rgba(0,0,0,0.25)] backdrop-blur-[8px] min-[700px]:w-[470px] min-[700px]:px-[28px] min-[700px]:py-[20px]">
          <div className="mb-[17px] text-center">
            <h2 className="mb-[5px] text-[21px] text-[#102a43]">{t('login.cardTitle')}</h2>
            <p className="text-[12px] text-[#64748b]">{t('login.cardSubtitle')}</p>
          </div>

          <form onSubmit={handleEmailLogin}>
            <div className="mb-[13px]">
              <label htmlFor="email" className="mb-[5px] block text-[13px] font-bold text-[#172b4d]">
                {t('login.emailLabel')}
              </label>
              <div className="relative">
                <span aria-hidden className="absolute left-[13px] top-1/2 z-[2] -translate-y-1/2 text-[15px] text-[#64748b]">
                  ✉
                </span>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@oilindia.in"
                  className="h-[43px] w-full rounded-[7px] border border-[#d5dde6] bg-white px-[40px] text-[13px] text-[#172b4d] outline-none transition placeholder:text-[#9aa5b1] focus:border-[#1769d1] focus:shadow-[0_0_0_3px_rgba(23,105,209,0.10)]"
                />
              </div>
            </div>

            <div className="mb-[13px]">
              <label htmlFor="password" className="mb-[5px] block text-[13px] font-bold text-[#172b4d]">
                {t('login.passwordLabel')}
              </label>
              <div className="relative">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="absolute left-[13px] top-1/2 z-[2] h-[15px] w-[15px] -translate-y-1/2 text-[#64748b]"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('login.passwordPlaceholder')}
                  className="h-[43px] w-full rounded-[7px] border border-[#d5dde6] bg-white px-[40px] text-[13px] text-[#172b4d] outline-none transition placeholder:text-[#9aa5b1] focus:border-[#1769d1] focus:shadow-[0_0_0_3px_rgba(23,105,209,0.10)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={t('login.togglePasswordAria')}
                  className="absolute right-[12px] top-1/2 -translate-y-1/2 cursor-pointer border-none bg-transparent text-[13px] text-[#64748b]"
                >
                  {showPassword ? '◎' : '◉'}
                </button>
              </div>
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="mt-[5px] block text-right text-[11px] text-[#1769d1] no-underline"
              >
                {t('login.forgotPassword')}
              </a>
            </div>

            <button
              type="submit"
              className="h-[43px] w-full cursor-pointer rounded-[7px] border-none bg-[#1769d1] text-[14px] font-bold text-white transition hover:-translate-y-px hover:bg-[#0e58b8]"
            >
              {t('login.loginButton')} <span className="ml-[7px] text-[17px]">→</span>
            </button>
          </form>

          <div className="mb-[12px] mt-[16px] flex items-center gap-[10px]">
            <span className="h-px flex-1 bg-[#dce3ea]" />
            <p className="text-[12px] font-semibold text-[#64748b]">{t('login.orDivider')}</p>
            <span className="h-px flex-1 bg-[#dce3ea]" />
          </div>

          <div>
            <p className="mb-[11px] text-center text-[13px] text-[#64748b]">{t('login.continueAs')}</p>
            <div className="grid grid-cols-1 gap-[11px] min-[700px]:grid-cols-2">
              {supervisors.map((u) => (
                <button
                  key={u.id}
                  onClick={() => loginAs(u)}
                  aria-label={t('login.continueAsAria', { role: t('login.supervisorRole'), name: u.name })}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-none bg-[#3f9142] p-[13px] text-left text-white transition hover:-translate-y-[2px] hover:bg-[#34793a] hover:shadow-[0_7px_18px_rgba(0,0,0,0.15)]"
                >
                  <span aria-hidden className="text-[18px]">
                    👷
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold leading-tight">{t('login.supervisorRole')}</span>
                    <span className="block text-[11px] font-medium text-white/85">{u.name}</span>
                  </span>
                </button>
              ))}
              {planners.map((u) => (
                <button
                  key={u.id}
                  onClick={() => loginAs(u)}
                  aria-label={t('login.continueAsAria', { role: t('login.plannerRole'), name: u.name })}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-none bg-[#c0791d] p-[13px] text-left text-white transition hover:-translate-y-[2px] hover:bg-[#a5680f] hover:shadow-[0_7px_18px_rgba(0,0,0,0.15)]"
                >
                  <span aria-hidden className="text-[18px]">
                    🦺
                  </span>
                  <span>
                    <span className="block text-[14px] font-bold leading-tight">{t('login.plannerRole')}</span>
                    <span className="block text-[11px] font-medium text-white/85">{u.name}</span>
                  </span>
                </button>
              ))}
              {workers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => loginAs(u)}
                  aria-label={`${t('worker.workerRole')} ${u.name}`}
                  className="flex cursor-pointer items-center justify-center gap-2 rounded-[9px] border-none bg-[#1769d1] p-[13px] text-left text-white transition hover:-translate-y-[2px] hover:bg-[#0e58b8] hover:shadow-[0_7px_18px_rgba(0,0,0,0.15)]"
                >
                  <span aria-hidden className="text-[18px]">🦺</span>
                  <span>
                    <span className="block text-[14px] font-bold leading-tight">{t('worker.workerRole')}</span>
                    <span className="block text-[11px] font-medium text-white/85">{u.name}</span>
                  </span>
                </button>
              ))}
            </div>
            <p className="mt-[11px] text-center text-[11px] text-[#64748b]">{t('login.note')}</p>
          </div>
        </div>

        <button
          onClick={() => setResetOpen(true)}
          className="mt-[10px] cursor-pointer border-none bg-transparent text-[12px] font-medium text-white/80 underline-offset-2 hover:text-white hover:underline [text-shadow:0_1px_5px_rgba(0,0,0,0.45)]"
        >
          {t('login.resetLink')}
        </button>
      </section>

      <footer className="relative z-[2] mt-[15px] flex flex-wrap items-center justify-center gap-[8px] px-[15px] py-[10px] text-[11px] font-semibold text-white [text-shadow:0_1px_5px_rgba(0,0,0,0.45)] min-[700px]:mt-0 min-[700px]:gap-[16px]">
        <div className="flex items-center gap-[5px]">
          <span className="text-[15px]">◈</span> {t('login.featureAi')}
        </div>
        <div className="hidden h-[17px] w-px bg-[rgba(255,255,255,0.65)] min-[700px]:block" />
        <div className="flex items-center gap-[5px]">
          <span className="text-[15px]">◎</span> {t('login.featureLang')}
        </div>
        <div className="hidden h-[17px] w-px bg-[rgba(255,255,255,0.65)] min-[700px]:block" />
        <div className="flex items-center gap-[5px]">
          <span className="text-[15px]">▥</span> {t('login.featureData')}
        </div>
        <div className="hidden h-[17px] w-px bg-[rgba(255,255,255,0.65)] min-[700px]:block" />
        <div className="flex items-center gap-[5px]">
          <span className="text-[15px]">◇</span> {t('login.featureGrounded')}
        </div>
      </footer>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={handleReset}
        title={t('common.resetDemo')}
        message={t('common.resetConfirm')}
        confirmText={t('common.reset')}
        cancelText={t('common.cancel')}
      />
    </main>
  )
}
