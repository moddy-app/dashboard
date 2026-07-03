import * as React from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertCircleIcon, BanIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { SubjectInline } from "@/components/cases/actor"
import { CreateCaseDialog } from "@/components/cases/create-case-dialog"
import { formatDate } from "@/lib/cases-format"
import { listBlacklist } from "@/services/cases"
import type { BlacklistEntry } from "@/services/cases-types"
import { useCasesMeta } from "@/hooks/useCasesMeta"
import { useViewer } from "@/hooks/useViewer"

const PAGE = 50

export function BlacklistPage() {
  const navigate = useNavigate()
  const viewer = useViewer()
  const { meta } = useCasesMeta()
  const [createOpen, setCreateOpen] = React.useState(false)

  const [items, setItems] = React.useState<BlacklistEntry[]>([])
  const [status, setStatus] = React.useState<"loading" | "success" | "error">(
    "loading"
  )
  const [error, setError] = React.useState<Error | null>(null)
  const [hasMore, setHasMore] = React.useState(false)
  const [loadingMore, setLoadingMore] = React.useState(false)

  const fetchPage = React.useCallback(async (offset: number) => {
    try {
      const page = await listBlacklist({ limit: PAGE, offset })
      setItems((prev) => (offset === 0 ? page : [...prev, ...page]))
      setHasMore(page.length === PAGE)
      setStatus("success")
    } catch (err) {
      setError(err as Error)
      setStatus((s) => (offset === 0 ? "error" : s))
    } finally {
      setLoadingMore(false)
    }
  }, [])

  React.useEffect(() => {
    fetchPage(0)
  }, [fetchPage])

  const loadMore = () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    fetchPage(items.length)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border px-4 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Blacklist</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Entités bannies globalement (ban global actif).
            </p>
          </div>
          {viewer.isModerator && meta && (
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <PlusIcon />
              Blacklister
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {status === "loading" ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 sm:px-6">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="ml-auto h-3 w-20" />
              </div>
            ))}
          </div>
        ) : status === "error" ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <AlertCircleIcon className="size-6 text-destructive" />
            <p className="mt-3 text-sm font-medium">Chargement impossible</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.message}
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-border bg-muted/40">
              <BanIcon className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium">Blacklist vide</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Aucune entité n'est actuellement blacklistée.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((entry) => (
              <Link
                key={entry.id}
                to={`/staff/cases/${entry.reference}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 sm:px-6"
              >
                <SubjectInline
                  subjectType={entry.subject_type}
                  subjectId={entry.subject_id}
                  size="md"
                />
                <span className="hidden min-w-0 flex-1 truncate text-sm text-muted-foreground md:block">
                  {entry.reason}
                </span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">
                  {entry.reference}
                </span>
                <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">
                  {formatDate(entry.sanctioned_at)}
                </span>
              </Link>
            ))}
            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  {loadingMore && <Spinner className="size-3.5" />}
                  Charger plus
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {meta && (
        <CreateCaseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          meta={meta}
          defaults={{ subject_type: "discord_user", scope_type: "platform" }}
          onCreated={(created) => {
            setCreateOpen(false)
            navigate(`/staff/cases/${created.reference}`)
          }}
        />
      )}
    </div>
  )
}
