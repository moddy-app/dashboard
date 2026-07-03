import { createContext } from "react"

import {
  languageLabels,
  type Language,
  type TranslationKey,
} from "./translations"

export type I18nContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey) => string
  languages: Language[]
  languageLabels: typeof languageLabels
}

export const I18nContext = createContext<I18nContextValue | null>(null)
