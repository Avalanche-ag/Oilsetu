import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/cn'
import { updateUserLanguage } from '../../services/api'
import { useAuth } from '../../store/auth'

export function LanguageToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation()
  const userId = useAuth((s) => s.userId)

  const setLang = (lang: 'en' | 'hi') => {
    i18n.changeLanguage(lang)
    if (userId) updateUserLanguage(userId, lang)
    localStorage.setItem('oilsetu-lang', lang)
  }

  return (
    <div className={cn('inline-flex rounded-lg border border-slate-300 bg-white p-0.5', className)}>
      <button
        onClick={() => setLang('en')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium',
          i18n.language === 'en' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLang('hi')}
        className={cn(
          'rounded-md px-2.5 py-1 text-xs font-medium',
          i18n.language === 'hi' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50'
        )}
      >
        हिं
      </button>
    </div>
  )
}
