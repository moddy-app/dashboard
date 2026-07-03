import { useCallback, useEffect, useState } from "react"

export type Theme = "light" | "dark"

const STORAGE_KEY = "moddy-theme"

/**
 * Read the theme currently applied to the document. The inline script in
 * `index.html` sets the `dark` class before React mounts, so this reflects
 * the resolved theme (explicit choice or system preference) with no flash.
 */
function getInitialTheme(): Theme {
  if (
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
  ) {
    return "dark"
  }
  return "light"
}

function readStoredTheme(): Theme | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === "light" || value === "dark" ? value : null
  } catch {
    return null
  }
}

/**
 * Manage the light/dark theme with a manual toggle that overrides — and
 * persists over — the system preference.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  const applyTheme = useCallback((next: Theme) => {
    document.documentElement.classList.toggle("dark", next === "dark")
    setThemeState(next)
  }, [])

  const setTheme = useCallback(
    (next: Theme) => {
      try {
        window.localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Ignore persistence failures (e.g. private browsing).
      }
      applyTheme(next)
    },
    [applyTheme]
  )

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  // Follow the OS theme while the user hasn't made an explicit choice.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) => {
      if (!readStoredTheme()) applyTheme(event.matches ? "dark" : "light")
    }
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [applyTheme])

  return { theme, setTheme, toggleTheme }
}
