/**
 * Translation dictionaries for the Moddy Dashboard landing page.
 *
 * Every language shares the exact same set of keys, which lets us derive
 * a strongly-typed `TranslationKey` from the English source of truth.
 */
export const translations = {
  en: {
    badge: "Under construction",
    title: "We're building something great",
    description:
      "The Moddy Dashboard is currently under construction. We're working hard to bring you a brand-new experience — check back very soon.",
    supportPrompt: "Need a hand in the meantime?",
    support: "Join our support server",
    language: "Language",
    switchToLight: "Switch to light theme",
    switchToDark: "Switch to dark theme",
  },
  fr: {
    badge: "En travaux",
    title: "Nous préparons quelque chose de grand",
    description:
      "Le tableau de bord Moddy est actuellement en travaux. Nous travaillons dur pour vous offrir une toute nouvelle expérience — revenez très bientôt.",
    supportPrompt: "Besoin d'un coup de main en attendant ?",
    support: "Rejoindre le serveur de support",
    language: "Langue",
    switchToLight: "Passer au thème clair",
    switchToDark: "Passer au thème sombre",
  },
  es: {
    badge: "En construcción",
    title: "Estamos creando algo genial",
    description:
      "El panel de Moddy está actualmente en construcción. Trabajamos duro para ofrecerte una experiencia totalmente nueva — vuelve muy pronto.",
    supportPrompt: "¿Necesitas ayuda mientras tanto?",
    support: "Unirse al servidor de soporte",
    language: "Idioma",
    switchToLight: "Cambiar al tema claro",
    switchToDark: "Cambiar al tema oscuro",
  },
  de: {
    badge: "In Arbeit",
    title: "Wir bauen etwas Großartiges",
    description:
      "Das Moddy-Dashboard befindet sich derzeit im Aufbau. Wir arbeiten mit Hochdruck an einem völlig neuen Erlebnis — schau bald wieder vorbei.",
    supportPrompt: "Brauchst du in der Zwischenzeit Hilfe?",
    support: "Support-Server beitreten",
    language: "Sprache",
    switchToLight: "Zum hellen Design wechseln",
    switchToDark: "Zum dunklen Design wechseln",
  },
} as const

export type Language = keyof typeof translations
export type TranslationKey = keyof (typeof translations)["en"]

/** Human-readable labels shown in the language switcher. */
export const languageLabels: Record<Language, string> = {
  en: "English",
  fr: "Français",
  es: "Español",
  de: "Deutsch",
}
