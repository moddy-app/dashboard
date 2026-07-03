import { useEffect } from "react"
import { ArrowUpRight, Languages, LifeBuoy, Moon, Sun } from "lucide-react"

import { Logo } from "@/components/Logo"
import { useTheme } from "@/hooks/useTheme"
import { useTranslation } from "@/i18n"
import { cn } from "@/lib/utils"

const SUPPORT_URL = "https://moddy.app/support"

export function App() {
  const { t, lang, setLang, languages, languageLabels } = useTranslation()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    document.title = `Moddy — ${t("badge")}`
  }, [t])

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Ambient brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-8rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-brand/10 blur-[150px]" />
      </div>

      {/* Header — logo (left) + theme toggle (right) */}
      <header className="flex shrink-0 items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        <Logo className="h-7 text-brand sm:h-8" />
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? t("switchToLight") : t("switchToDark")}
          title={theme === "dark" ? t("switchToLight") : t("switchToDark")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/60 text-muted-foreground backdrop-blur-sm transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Sun className="hidden h-4 w-4 dark:block" />
          <Moon className="block h-4 w-4 dark:hidden" />
        </button>
      </header>

      {/* Main — framed content, centered */}
      <main className="flex flex-1 items-center justify-center px-6 py-6">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <article className="relative overflow-hidden rounded-3xl border border-border bg-card/80 p-8 text-left shadow-xl shadow-black/5 backdrop-blur-xl sm:p-10">
            {/* Top accent line */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/70 to-transparent"
            />

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              {t("badge")}
            </div>

            {/* Title */}
            <h1 className="mt-5 text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {t("title")}
            </h1>

            {/* Description */}
            <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t("description")}
            </p>

            {/* Divider */}
            <div className="my-7 h-px w-full bg-border" />

            {/* Support call to action */}
            <p className="text-sm text-muted-foreground/80">{t("supportPrompt")}</p>
            <a
              href={SUPPORT_URL}
              className="group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card"
            >
              <LifeBuoy className="h-4 w-4" />
              {t("support")}
              <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </article>
        </div>
      </main>

      {/* Footer — language switcher, bottom */}
      <footer className="flex shrink-0 items-center justify-center gap-3 px-6 py-6 sm:py-8">
        <Languages
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground/70"
        />
        <span className="sr-only">{t("language")}</span>
        <div className="flex flex-wrap items-center justify-center gap-1">
          {languages.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => setLang(code)}
              aria-pressed={lang === code}
              aria-label={languageLabels[code]}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium uppercase tracking-wide transition-colors",
                lang === code
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {code}
            </button>
          ))}
        </div>
      </footer>
    </div>
  )
}

export default App
