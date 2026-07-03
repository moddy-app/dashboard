import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { I18nContext, type I18nContextValue } from "./context"
import {
  languageLabels,
  translations,
  type Language,
} from "./translations"

const LANGUAGES = Object.keys(translations) as Language[]
const STORAGE_KEY = "moddy-lang"
const DEFAULT_LANGUAGE: Language = "en"

function isSupported(value: string | null | undefined): value is Language {
  return value != null && (LANGUAGES as string[]).includes(value)
}

/**
 * Resolve the initial language from (1) a previously saved choice, then
 * (2) the browser's preferred language, falling back to English.
 */
function detectLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE

  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (isSupported(saved)) return saved

  const navigatorLang = window.navigator.language?.slice(0, 2).toLowerCase()
  return isSupported(navigatorLang) ? navigatorLang : DEFAULT_LANGUAGE
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ignore storage failures (e.g. private browsing) — the choice still
      // applies for the current session.
    }
  }, [])

  const t = useCallback(
    (key: Parameters<I18nContextValue["t"]>[0]) =>
      translations[lang][key] ?? translations[DEFAULT_LANGUAGE][key],
    [lang]
  )

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t, languages: LANGUAGES, languageLabels }),
    [lang, setLang, t]
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
