import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { SearchIcon, ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { usePageTitle } from "@/hooks/usePageTitle"

// Pages connues pour la recherche 404
const KNOWN_PAGES = [
  { label: 'Dashboard', path: '/' },
  { label: 'Debug', path: '/debug' },
  { label: 'Staff', path: '/staff' },
]

export function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle(t('pageTitle.notFound'))
  const navigate = useNavigate()
  const [query, setQuery] = useState('')

  const filteredPages = query.trim()
    ? KNOWN_PAGES.filter((p) =>
        p.label.toLowerCase().includes(query.toLowerCase())
      )
    : []

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (filteredPages.length === 1) {
      navigate(filteredPages[0].path)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Empty className="border border-dashed max-w-lg w-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchIcon />
          </EmptyMedia>
          <EmptyTitle>{t('notFound.title')}</EmptyTitle>
          <EmptyDescription>
            {t('notFound.description')}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="w-full flex flex-col items-center gap-3">
          <form onSubmit={handleSearch} className="w-full sm:w-3/4">
            <InputGroup className="w-full">
              <InputGroupInput
                placeholder={t('notFound.searchPlaceholder')}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
              />
              <InputGroupAddon>
                <SearchIcon className="size-4" />
              </InputGroupAddon>
            </InputGroup>
          </form>

          {/* Résultats de recherche */}
          {filteredPages.length > 0 && (
            <div className="w-full sm:w-3/4 rounded-lg border bg-popover shadow-sm overflow-hidden">
              {filteredPages.map((page) => (
                <button
                  key={page.path}
                  type="button"
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent hover:text-accent-foreground transition-colors"
                  onClick={() => navigate(page.path)}
                >
                  <SearchIcon className="size-4 text-muted-foreground shrink-0" />
                  <span>{page.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{page.path}</span>
                </button>
              ))}
            </div>
          )}

          <EmptyDescription>
            <a href="https://moddy.app/support" target="_blank" rel="noopener noreferrer" className="hover:underline">
              {t('notFound.contactSupport')}
            </a>
          </EmptyDescription>
        </EmptyContent>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/")}
          className="mt-2"
        >
          <ArrowLeftIcon className="size-4" />
          {t('notFound.backToDashboard')}
        </Button>
      </Empty>
    </div>
  )
}
