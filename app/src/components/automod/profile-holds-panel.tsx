import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon, InboxIcon, RefreshIcon } from "@hugeicons/core-free-icons"
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { UserChip } from "@/components/user-chip"
import { absoluteTime, relativeTime } from "@/lib/cases"
import { logger } from "@/lib/logger"
import { getProfileHolds } from "@/services/automod"
import type { AutomodProfileHold } from "@/types/api"

// Lecture seule : Moddy lève lui-même le timeout quand le profil est corrigé.
// `timeout_until` passé = renouvellement en attente du prochain balayage, pas
// une fin de sanction : l'état affiché reste « en attente de correction » et
// il n'y a volontairement aucun compte à rebours.

const PAGE_SIZE = 50

const holdKey = (h: AutomodProfileHold) => `${h.user_id}:${h.kind}`

export function AutomodProfileHoldsPanel({ guildId }: { guildId: string }) {
  const { t, i18n } = useTranslation()
  const [items, setItems] = useState<AutomodProfileHold[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestSeq = useRef(0)

  const load = useCallback(
    async () => {
      const seq = ++requestSeq.current
      try {
        const page = await getProfileHolds(guildId, { limit: PAGE_SIZE, offset: 0 })
        if (seq !== requestSeq.current) return
        setItems(page.holds)
        setTotal(page.total)
        setError(null)
      } catch (e) {
        if (seq !== requestSeq.current) return
        logger.error("module:automod_ai", "Profile holds failed", e)
        setError(e instanceof Error ? e.message : "Failed to load profile holds")
      } finally {
        if (seq === requestSeq.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [guildId]
  )

  useEffect(() => {
    // `isLoading` démarre à true ; les setState du chargement sont asynchrones.
    const id = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(id)
  }, [load])

  const refresh = () => {
    setIsRefreshing(true)
    void load()
  }

  const retry = () => {
    setIsLoading(true)
    void load()
  }

  const loadMore = useCallback(async () => {
    const seq = requestSeq.current
    setIsLoadingMore(true)
    try {
      const page = await getProfileHolds(guildId, { limit: PAGE_SIZE, offset: items.length })
      if (seq !== requestSeq.current) return
      // Un profil corrigé entre deux pages décale l'offset : doublons écartés.
      setItems((prev) => {
        const known = new Set(prev.map(holdKey))
        return [...prev, ...page.holds.filter((h) => !known.has(holdKey(h)))]
      })
      setTotal(page.total)
    } catch (e) {
      logger.error("module:automod_ai", "Profile holds load more failed", e)
      setError(e instanceof Error ? e.message : "Failed to load profile holds")
    } finally {
      setIsLoadingMore(false)
    }
  }, [guildId, items.length])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">{t("modules.automod_ai.profileHolds.intro")}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={isLoading || isRefreshing}
        >
          {isRefreshing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} data-icon="inline-start" />
          )}
          {t("modules.automod_ai.profileHolds.refresh")}
        </Button>
      </div>

      {error && items.length === 0 ? (
        <Alert variant="destructive">
          <HugeiconsIcon icon={AlertCircleIcon} strokeWidth={2} />
          <AlertTitle>{t("modules.automod_ai.profileHolds.errorTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={retry}>
              {t("modules.automod_ai.profileHolds.retry")}
            </Button>
          </AlertAction>
        </Alert>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <HugeiconsIcon icon={InboxIcon} strokeWidth={2} />
            </EmptyMedia>
            <EmptyTitle>{t("modules.automod_ai.profileHolds.emptyTitle")}</EmptyTitle>
            <EmptyDescription>{t("modules.automod_ai.profileHolds.emptyDescription")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <ItemGroup className="gap-2">
            {items.map((hold) => (
              <HoldRow key={holdKey(hold)} hold={hold} guildId={guildId} locale={i18n.language} />
            ))}
          </ItemGroup>
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              {t("modules.automod_ai.profileHolds.count", { shown: items.length, total })}
            </p>
            {items.length < total && (
              <Button variant="outline" size="sm" onClick={() => void loadMore()} disabled={isLoadingMore}>
                {isLoadingMore && <Spinner data-icon="inline-start" />}
                {t("modules.automod_ai.profileHolds.loadMore")}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function HoldRow({
  hold,
  guildId,
  locale,
}: {
  hold: AutomodProfileHold
  guildId: string
  locale: string
}) {
  const { t } = useTranslation()
  const kindLabel =
    hold.kind === "avatar" || hold.kind === "banner"
      ? t(`modules.automod_ai.profileHolds.kind.${hold.kind}`)
      : hold.kind
  // Catégorie inconnue : id brut plutôt que rien (nouvelle valeur côté bot).
  const categoryLabel = hold.categorie
    ? t(`modules.automod_ai.profileHolds.category.${hold.categorie}`, { defaultValue: hold.categorie })
    : null

  return (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-0">
        <ItemTitle className="max-w-full">
          <UserChip userId={hold.user_id} />
        </ItemTitle>
        <ItemDescription>
          <span title={absoluteTime(hold.created_at, locale)}>
            {t("modules.automod_ai.profileHolds.since", { when: relativeTime(hold.created_at, locale) })}
          </span>
          {" · "}
          <span title={hold.last_checked ? absoluteTime(hold.last_checked, locale) : undefined}>
            {hold.last_checked
              ? t("modules.automod_ai.profileHolds.lastChecked", {
                  when: relativeTime(hold.last_checked, locale),
                })
              : t("modules.automod_ai.profileHolds.neverChecked")}
          </span>
        </ItemDescription>
      </ItemContent>
      <ItemActions className="flex-wrap justify-end">
        <Badge variant="outline">{kindLabel}</Badge>
        {categoryLabel && <Badge variant="secondary">{categoryLabel}</Badge>}
        <Badge variant="outline">{t("modules.automod_ai.profileHolds.pending")}</Badge>
        {hold.case_id && (
          <Button variant="link" size="sm" asChild>
            <Link to={`/servers/${guildId}/cases?case=${encodeURIComponent(hold.case_id)}`}>
              {t("modules.automod_ai.profileHolds.viewCase")}
            </Link>
          </Button>
        )}
      </ItemActions>
    </Item>
  )
}
