import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getPreferences, detectBrowserLanguage } from './lib/preferences'

import en from './locales/en/translation.json'
import fr from './locales/fr/translation.json'

const SUPPORTED_LANGUAGES = ['en', 'fr']
const FALLBACK_LANGUAGE = 'en'

// Determine initial language: cookie preference > browser detection > fallback
const prefs = getPreferences()
const initialLanguage = prefs.language ?? detectBrowserLanguage(SUPPORTED_LANGUAGES, FALLBACK_LANGUAGE)

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    lng: initialLanguage,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
