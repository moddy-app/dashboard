import { useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { RefreshIcon, Timer02Icon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
  ItemActions,
} from "@/components/ui/item"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { DirectoryIcon } from "@/components/bump-reminder/directory-icon"
import { UserChip } from "@/components/user-chip"
import { absoluteTime } from "@/lib/cases"
import { formatCountdown } from "@/lib/bump-reminder"
import type { BumpDirectoryState, BumpState } from "@/types/bump-reminder"

/**
 * Comptes à rebours en direct — **une ligne par annuaire**, pas par rappel : un
 * bump réarme tous les rappels de l'annuaire. Le compte à rebours est calculé
 * depuis `due_at` (jamais depuis `seconds_remaining`, juste à l'instant de la
 * requête), et `/state` est rechargé quand l'un d'eux atteint zéro.
 */
export function BumpLiveState({
  state,
  isRefreshing,
  onRefresh,
}: {
  state: BumpState | null
  isRefreshing: boolean
  onRefresh: () => void
}) {
  const { t } = useTranslation()
  const now = useNow(state?.directories.some((d) => d.state === "scheduled") ?? false)

  // Un compte à rebours arrivé à zéro : on relit l'état une fois (le bot passe
  // la ligne en `due` puis `sent`). `firedFor` évite de boucler sur la même
  // échéance tant que la réponse n'a pas changé.
  const firedFor = useRef<string | null>(null)
  const onRefreshRef = useRef(onRefresh)
  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])
  useEffect(() => {
    const expired = state?.directories.find(
      (d) => d.state === "scheduled" && d.due_at && Date.parse(d.due_at) <= now
    )
    const key = expired ? `${expired.bot}:${expired.due_at}` : null
    if (key && firedFor.current !== key) {
      firedFor.current = key
      onRefreshRef.current()
    }
  }, [state, now])

  const rows = state?.directories.filter((d) => d.configured) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("modules.bump_reminder.live.title")}</CardTitle>
        <CardDescription>{t("modules.bump_reminder.live.description")}</CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label={t("modules.bump_reminder.live.refresh")}
          >
            {isRefreshing ? <Spinner /> : <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!state ? (
          <Skeleton className="h-14 rounded-2xl" />
        ) : rows.length === 0 ? (
          <Empty className="p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <HugeiconsIcon icon={Timer02Icon} strokeWidth={2} />
              </EmptyMedia>
              <EmptyTitle>{t("modules.bump_reminder.live.emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("modules.bump_reminder.live.emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup className="gap-2">
            {rows.map((row) => (
              <LiveRow key={row.bot} row={row} now={now} />
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  )
}

function LiveRow({ row, now }: { row: BumpDirectoryState; now: number }) {
  const { t, i18n } = useTranslation()
  const K = "modules.bump_reminder.live"

  let title: ReactNode
  let badge: ReactNode = null
  switch (row.state) {
    case "scheduled": {
      const remaining = row.due_at ? (Date.parse(row.due_at) - now) / 1000 : row.seconds_remaining ?? 0
      title = t(`${K}.scheduled`, { time: formatCountdown(remaining) })
      badge = <Badge variant="outline">{t(`${K}.badge.scheduled`)}</Badge>
      break
    }
    case "due":
      title = t(`${K}.due`)
      badge = (
        <Badge variant="secondary">
          <Spinner data-icon="inline-start" />
          {t(`${K}.badge.due`)}
        </Badge>
      )
      break
    case "sent":
      title = t(`${K}.sent`)
      badge = <Badge>{t(`${K}.badge.sent`)}</Badge>
      break
    default:
      title = t(`${K}.neverBumped`)
  }

  return (
    <Item variant="outline" size="sm">
      <ItemMedia>
        <DirectoryIcon bot={row.bot} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        {/* `name` est une marque : jamais traduite. */}
        <ItemDescription>{row.name}</ItemDescription>
        <ItemTitle className="tabular-nums">{title}</ItemTitle>
        {row.state !== "never_bumped" && row.bumped_at && (
          // `div`, pas `ItemDescription` (`<p>`) : la puce de profil peut
          // rendre un `Skeleton` (bloc) pendant son chargement.
          <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {row.bumper_id ? (
              <>
                {t(`${K}.lastBumpBy`)}
                <UserChip userId={row.bumper_id} showAvatar={false} />
                {t(`${K}.lastBumpOn`, { date: absoluteTime(row.bumped_at, i18n.language) })}
              </>
            ) : (
              t(`${K}.lastBump`, { date: absoluteTime(row.bumped_at, i18n.language) })
            )}
            {row.opt_in && <> · {t(`${K}.optIn`)}</>}
          </div>
        )}
      </ItemContent>
      {badge && <ItemActions>{badge}</ItemActions>}
    </Item>
  )
}

/** Horloge à la seconde, seulement quand un compte à rebours est affiché. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}
