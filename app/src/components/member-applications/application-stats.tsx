import { useTranslation } from "react-i18next"
import { HugeiconsIcon } from "@hugeicons/react"
import { ChartBarLineIcon, DiscordIcon } from "@hugeicons/core-free-icons"
import { Badge } from "@/components/ui/badge"
import {
  Card,
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
  ItemActions,
  ItemContent,
  ItemGroup,
} from "@/components/ui/item"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { ErrorPage } from "@/components/error-state"
import { UserChip } from "@/components/user-chip"
import { ApplicationStatusBadge } from "@/components/member-applications/application-status-badge"
import { APPLICATION_STATUSES } from "@/types/member-applications"
import type { ApplicationStats } from "@/types/member-applications"

export function ApplicationStatsPanel({
  stats,
  error,
  onRetry,
}: {
  stats: ApplicationStats | null
  error: string | null
  onRetry: () => void
}) {
  const { t, i18n } = useTranslation()
  const nf = new Intl.NumberFormat(i18n.language)

  if (error && !stats) return <ErrorPage error={error} onRetry={onRetry} />
  if (!stats) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (stats.total === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HugeiconsIcon icon={ChartBarLineIcon} strokeWidth={2} />
          </EmptyMedia>
          <EmptyTitle>{t("modules.member_applications.stats.emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("modules.member_applications.stats.emptyDescription")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const decidedByOrigin = stats.by_origin.moddy + stats.by_origin.discord
  const moddyShare = decidedByOrigin > 0 ? Math.round((stats.by_origin.moddy / decidedByOrigin) * 100) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {APPLICATION_STATUSES.map((status) => (
          <Card key={status} size="sm">
            <CardHeader>
              <CardDescription>
                <ApplicationStatusBadge status={status} />
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">{nf.format(stats.by_status[status])}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("modules.member_applications.stats.originTitle")}</CardTitle>
          <CardDescription>{t("modules.member_applications.stats.originDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Progress value={moddyShare} aria-label={t("modules.member_applications.stats.originTitle")} />
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <span>
              {t("modules.member_applications.stats.originModdy", { count: stats.by_origin.moddy })}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <HugeiconsIcon icon={DiscordIcon} strokeWidth={2} className="size-4" />
              {t("modules.member_applications.stats.originDiscord", { count: stats.by_origin.discord })}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("modules.member_applications.stats.reviewersTitle")}</CardTitle>
          <CardDescription>{t("modules.member_applications.stats.reviewersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.reviewers.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("modules.member_applications.stats.noReviewers")}</p>
          ) : (
            // Ordre du backend conservé : trié par total décroissant.
            <ItemGroup className="gap-1">
              {stats.reviewers.map((reviewer) => (
                <Item key={reviewer.user_id} size="xs" variant="muted">
                  <ItemContent className="min-w-0">
                    <UserChip userId={reviewer.user_id} />
                  </ItemContent>
                  <ItemActions className="flex-wrap justify-end">
                    <Badge variant="default">
                      {t("modules.member_applications.stats.approvedCount", { count: reviewer.approved })}
                    </Badge>
                    <Badge variant="destructive">
                      {t("modules.member_applications.stats.rejectedCount", { count: reviewer.rejected })}
                    </Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t("modules.member_applications.stats.totalCount", { count: reviewer.total })}
                    </span>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
