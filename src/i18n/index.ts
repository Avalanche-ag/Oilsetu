import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'

const resources = {
  en: { translation: en },
  hi: { translation: hi },
}

export function initI18n(lng: string) {
  i18n.use(initReactI18next).init({
    resources,
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  })
}

export { i18n }
export default i18n
