import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/cn'
import { updateUserLanguage } from '../../services/api'
import { useAuth } from '../../store/auth'

export function LanguageToggle({ className, tone = 'light' }: { className?: string; tone?: 'light' | 'dark' }) {
  const { i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)

  const setLang = (lang: 'en' | 'hi') => {
    i18n.changeLanguage(lang)
    if (userId) updateUserLanguage(userId, lang)
    localStorage.setItem('oilsetu-lang', lang)
  }

  const dark = tone === 'dark'

  return (
    <div className={cn('inline-flex rounded-lg border p-0.5', dark ? 'border-white/40 bg-black/30 backdrop-blur-sm' : 'border-slate-300 bg-white', className)}>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium',
          i18n.language === 'en' ? (dark ? 'bg-white text-slate-900' : 'bg-brand-600 text-white') : (dark ? 'text-white/85 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-50')
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLang('hi')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium',
          i18n.language === 'hi' ? (dark ? 'bg-white text-slate-900' : 'bg-brand-600 text-white') : (dark ? 'text-white/85 hover:bg-white/10' : 'text-slate-600 hover:bg-slate-50')
        )}
      >
        हिं
      </button>
    </div>
  )
}
