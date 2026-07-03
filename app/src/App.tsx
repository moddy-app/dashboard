import { useEffect } from "react"
import { ArrowUpRight, Languages, LifeBuoy } from "lucide-react"

import { Logo } from "@/components/Logo"
import { useTranslation } from "@/i18n"
import { cn } from "@/lib/utils"

const SUPPORT_URL = "https://moddy.app/support"

export function App() {
  const { t, lang, setLang, languages, languageLabels } = useTranslation()

  useEffect(() => {
    document.title = `Moddy — ${t("badge")}`
  }, [t])

  return (
    <main className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-background px-6 py-16 sm:px-10">
      {/* Ambient brand glow */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-0 h-[34rem] w-[34rem] -translate-x-1/3 rounded-full bg-brand/10 blur-[130px]" />
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-col items-start text-left animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        {/* Wordmark */}
        <Logo className="h-8 text-brand sm:h-9" />

        {/* Status badge */}
        <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand" />
          </span>
          {t("badge")}
        </div>

        {/* Title */}
        <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t("title")}
        </h1>

        {/* Description */}
        <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground">
          {t("description")}
        </p>

        {/* Support call to action */}
        <div className="mt-9 flex flex-col items-start gap-3">
          <span className="text-sm text-muted-foreground/80">
            {t("supportPrompt")}
          </span>
          <a
            href={SUPPORT_URL}
            className="group inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-brand/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <LifeBuoy className="h-4 w-4" />
            {t("support")}
            <ArrowUpRight className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>

      {/* Language switcher */}
      <footer className="mx-auto mt-16 flex w-full max-w-xl items-center gap-3 animate-in fade-in duration-1000">
        <Languages
          aria-hidden
          className="h-4 w-4 shrink-0 text-muted-foreground/70"
        />
        <span className="sr-only">{t("language")}</span>
        <div className="flex flex-wrap items-center gap-1">
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
    </main>
  )
}

export default App
