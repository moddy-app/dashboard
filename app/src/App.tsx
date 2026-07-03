import { useEffect } from "react"
import { ArrowUpRight, Languages, LifeBuoy, Moon, Sun } from "lucide-react"

import { Logo } from "@/components/Logo"
import { useTheme } from "@/hooks/useTheme"
import { useTranslation } from "@/i18n"
import { cn } from "@/lib/utils"

const SUPPORT_URL = "https://moddy.app/support"
const MODDY_URL = "https://moddy.app"

export function App() {
  const { t, lang, setLang, languages, languageLabels } = useTranslation()
  const { theme, toggleTheme } = useTheme()

  useEffect(() => {
    document.title = `Moddy — ${t("badge")}`
  }, [t])

  // Easter egg: give the Moddy mark a playful little bounce on hover/focus.
  const pokeLogo = (event: React.SyntheticEvent<HTMLAnchorElement>) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const mark = event.currentTarget.querySelector(".moddy-logo-mark")
    mark?.animate(
      [
        { transform: "translateY(0) rotate(0deg) scale(1)" },
        { transform: "translateY(-20%) rotate(-10deg) scale(1.1)", offset: 0.3 },
        { transform: "translateY(0) rotate(7deg) scale(0.97)", offset: 0.55 },
        { transform: "translateY(-7%) rotate(-3deg) scale(1.02)", offset: 0.78 },
        { transform: "translateY(0) rotate(0deg) scale(1)" },
      ],
      { duration: 700, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header — logo (left) + theme toggle (right) */}
      <header className="flex shrink-0 items-center justify-between px-6 py-6 sm:px-10 sm:py-8">
        {/* Logo — links to moddy.app, plays an easter egg on hover */}
        <a
          href={MODDY_URL}
          onMouseEnter={pokeLogo}
          onFocus={pokeLogo}
          aria-label="Moddy"
          className="-m-1.5 rounded-md p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Logo className="h-9 text-brand sm:h-10" />
        </a>
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
        <div className="w-full max-w-xl animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
          <article className="rounded-3xl border border-border bg-card p-8 text-left sm:p-10">
            {/* Status badge */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand" />
              </span>
              {t("badge")}
            </div>

            {/* Title */}
            <h1 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {t("title")}
            </h1>

            {/* Description */}
            <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("description")}
            </p>

            {/* Divider */}
            <div className="my-7 h-px w-full bg-border" />

            {/* Support call to action */}
            <p className="text-sm text-muted-foreground/80 sm:text-base">
              {t("supportPrompt")}
            </p>
            <a
              href={SUPPORT_URL}
              className="group mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-base font-semibold text-white transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-card"
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
