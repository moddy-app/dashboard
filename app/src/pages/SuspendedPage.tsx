import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ExternalLinkIcon, LogOutIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarUrl, getDisplayName, logout, type User } from "@/lib/auth"
import { usePageTitle } from "@/hooks/usePageTitle"
import { APPEAL_URL, LEVEL_TONE, formatDeadline } from "@/lib/sanctions"
import { getViolations } from "@/services/violations"
import { logger } from "@/lib/logger"
import type { SubjectSanctionStatus, ViolationGroup } from "@/types/violations"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
import { EnforcementNotice, ReferenceChip } from "@/components/violations/violation-badges"

/**
 * Écran d'un compte suspendu. **Pas un dashboard grisé** : tous les autres
 * appels renverraient 403. Seuls restent joignables `/auth/*`, `/cases*` et
 * `/violations*` — c'est exactement ce que cet écran utilise.
 */
export function SuspendedScreen({
  status,
  user,
}: {
  status: SubjectSanctionStatus
  user: User
}) {
  const { t, i18n } = useTranslation()
  usePageTitle(t("violations.suspended.title"))

  const [groups, setGroups] = useState<ViolationGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    let active = true
    getViolations({ limit: 50 })
      .then((data) => active && setGroups(data))
      .catch((e) => logger.warn("sanctions", "Failed to load violations on suspended screen", e))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    window.location.reload()
  }

  const tone = LEVEL_TONE.suspended
  const Icon = tone.icon
  const sanction = status.sanctions[0] ?? null
  const expires = formatDeadline(sanction?.expires_at, i18n.language)
  // Le compte à rebours vit sur le groupe, pas sur le statut : on prend celui de
  // l'infraction active la plus récente.
  const enforcement = groups.find((g) => g.active && g.enforcement)?.enforcement ?? null

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Même grain que l'écran d'authentification — on reste chez Moddy. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='256' height='256' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "256px 256px",
        }}
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-5 py-10 sm:py-16">
        {/* Compte concerné */}
        <div className="flex items-center gap-3">
          <Avatar className="size-8 rounded-lg">
            <AvatarImage
              src={getAvatarUrl(user.user_id, user.avatar, user.avatar_url)}
              alt={getDisplayName(user)}
              referrerPolicy="no-referrer"
            />
            <AvatarFallback className="rounded-lg text-xs">
              {getDisplayName(user).slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">@{user.username}</p>
            <p className="truncate font-mono text-xs text-muted-foreground">{user.user_id}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loggingOut}>
            <LogOutIcon className="size-4" />
            {t("navUser.logOut")}
          </Button>
        </div>

        {selected ? (
          <ViolationDetailView
            groupId={selected}
            onBack={() => setSelected(null)}
            backLabel={t("violations.suspended.backToSummary")}
          />
        ) : (
          <>
            {/* En-tête de suspension */}
            <div className={`flex flex-col gap-4 rounded-2xl border p-6 ${tone.border} ${tone.softBg}`}>
              <div className="flex items-start gap-4">
                <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone.bg}`}>
                  <Icon className={`size-5 ${tone.text}`} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-xl font-semibold leading-tight sm:text-2xl">
                    {t("violations.suspended.title")}
                  </h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("violations.suspended.description")}
                  </p>
                </div>
              </div>

              {sanction && (
                <div className="flex flex-col gap-2 rounded-xl border bg-background/60 p-4">
                  <p className="text-sm font-medium">{sanction.reason}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {status.sanctions.map((s) => (
                      <ReferenceChip key={s.reference} reference={s.reference} />
                    ))}
                    <span>
                      {expires
                        ? t("violations.detail.until", { date: expires })
                        : t("violations.detail.permanent")}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href={APPEAL_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" />
                    {t("violations.appeal")}
                  </a>
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCwIcon className="size-4" />
                  {t("violations.suspended.recheck")}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {t("violations.suspended.appealNote")}
              </p>
            </div>

            {enforcement && (
              <EnforcementNotice enforcement={enforcement} appealUrl={APPEAL_URL} />
            )}

            {/* Dossier complet — accessible même suspendu */}
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold">{t("violations.suspended.record")}</h2>
              <ViolationList
                groups={groups}
                loading={loading}
                onOpen={setSelected}
                emptyTitle={t("violations.suspended.emptyTitle")}
                emptyDescription={t("violations.suspended.emptyDescription")}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
