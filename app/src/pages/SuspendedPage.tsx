import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ArrowUpRightIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LogOutIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import { ModdyLogo } from "@/components/moddy-logo"
import { getAvatarUrl, getDisplayName, logout, type User } from "@/lib/auth"
import { usePageTitle } from "@/hooks/usePageTitle"
import { APPEAL_URL, LEVEL_TONE, TERMS_URL } from "@/lib/sanctions"
import { getViolations } from "@/services/violations"
import { getSubscriptionStatus, openBillingPortal } from "@/services/guilds"
import { logger } from "@/lib/logger"
import type { SubscriptionData } from "@/types/api"
import type { SubjectSanctionStatus, ViolationGroup } from "@/types/violations"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
import { SanctionScale } from "@/components/violations/sanction-scale"
import {
  EnforcementNotice,
  ExpiryLabel,
  GlobalActionChip,
  ReferenceText,
} from "@/components/violations/violation-badges"

// ─── Sanction en cours ────────────────────────────────────────────────────────

/**
 * Le bloc que la personne est venue lire : ce qu'on lui reproche, ce que ça lui
 * coûte, jusqu'à quand. C'est le **seul** endroit de l'écran où le motif est
 * écrit — l'historique en dessous ne montre que les sanctions passées.
 */
function ActiveSanction({
  group,
  onOpen,
}: {
  group: ViolationGroup
  onOpen: (groupId: string) => void
}) {
  const { t } = useTranslation()

  // L'échéance des mesures actives : la même pour tout le groupe en pratique.
  const expiresAt = group.enforcement?.deadline ?? null

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex flex-col gap-2">
        <p className="text-base font-medium leading-relaxed">{group.reason}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {group.active_actions.map((action) => (
            <GlobalActionChip key={action} action={action} />
          ))}
          {!group.enforcement && (
            <ExpiryLabel expiresAt={expiresAt} className="text-xs text-muted-foreground" />
          )}
          <ReferenceText references={group.references} />
        </div>
      </div>

      {group.enforcement && (
        <div className="border-t pt-3">
          <EnforcementNotice
            enforcement={group.enforcement}
            appealUrl={APPEAL_URL}
            active={group.active}
            showAppeal={false}
            variant="inline"
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => onOpen(group.group_id)}
        className="inline-flex w-fit items-center gap-0.5 text-xs font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
      >
        {t("violations.suspended.seeDetail")}
        <ArrowUpRightIcon className="size-3" />
      </button>
    </div>
  )
}

// ─── Facturation ──────────────────────────────────────────────────────────────

/**
 * Un bouton, en pied de page. Une sanction ne gèle pas l'argent de quelqu'un —
 * `POST /stripe/portal` n'est bloqué par aucune sanction — mais la facturation
 * n'est pas ce qu'on vient chercher ici : elle ne prend pas une section.
 *
 * `GET /stripe/subscription` ne figure pas dans les exemptions du niveau
 * « suspendu » : il ne sert donc qu'à **masquer** le bouton quand il répond et
 * qu'il n'y a rien à gérer. Sans réponse — ou sur un refus — le bouton reste :
 * fermer un accès qui fonctionne sur la foi d'un endpoint muet serait le pire
 * des deux mondes.
 */
function BillingButton() {
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    let active = true
    getSubscriptionStatus()
      .then((data) => active && setSubscription(data))
      .catch((e) => logger.warn("sanctions", "Subscription status unavailable", e))
    return () => {
      active = false
    }
  }, [])

  const handleOpen = async () => {
    setOpening(true)
    try {
      window.location.href = await openBillingPortal()
    } catch (e) {
      logger.warn("sanctions", "Failed to open billing portal", e)
      toast.error(t("violations.suspended.billingError"))
      setOpening(false)
    }
  }

  if (subscription && !subscription.tier && !subscription.stripe_customer_id) return null

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleOpen}
      disabled={opening}
      className="text-muted-foreground"
    >
      <CreditCardIcon className="size-4" />
      {t("violations.suspended.billingAction")}
    </Button>
  )
}

// ─── Écran ────────────────────────────────────────────────────────────────────

/**
 * Écran d'un compte suspendu. **Pas un dashboard grisé** : tous les autres
 * appels renverraient 403. Seuls restent joignables `/auth/*`, `/cases*`,
 * `/violations*` et la facturation — c'est exactement ce que cet écran utilise.
 *
 * L'ordre de lecture est celui des questions qu'on se pose : qu'est-ce qui
 * m'arrive, pourquoi, jusqu'à quand, comment le contester. Le reste
 * (facturation, historique, déconnexion) est en périphérie.
 */
export function SuspendedScreen({
  status,
  user,
}: {
  status: SubjectSanctionStatus
  user: User
}) {
  const { t } = useTranslation()
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
  const { active, past } = useMemo(
    () => ({
      active: groups.filter((g) => g.active),
      past: groups.filter((g) => !g.active),
    }),
    [groups]
  )

  // Repli si `/violations` n'a rien renvoyé : le statut, lui, vient de
  // `/auth/me` et porte déjà le motif.
  const fallback = status.sanctions[0] ?? null
  const displayName = getDisplayName(user)

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

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-8 sm:py-12">
        {/* Barre d'identité : le logo dit chez qui on est, le compte dit qui est visé. */}
        <header className="flex items-center justify-between gap-4">
          <ModdyLogo className="h-8 w-auto sm:h-9" />
          <div className="flex items-center gap-2">
            <Avatar className="size-7 rounded-full">
              <AvatarImage
                src={getAvatarUrl(user.user_id, user.avatar, user.avatar_url)}
                alt={displayName}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback className="rounded-full text-[10px]">
                {displayName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[12rem] truncate text-sm font-medium sm:inline">
              @{user.username}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label={t("navUser.logOut")}
              title={t("navUser.logOut")}
            >
              <LogOutIcon className="size-4" />
            </Button>
          </div>
        </header>

        {selected ? (
          <div className="mt-8">
            <ViolationDetailView
              groupId={selected}
              onBack={() => setSelected(null)}
              backLabel={t("violations.suspended.backToSummary")}
            />
          </div>
        ) : (
          <>
            {/* 1. Le verdict, et où il se situe */}
            <section className="mt-10 flex flex-col gap-6">
              <div>
                <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {t("violations.suspended.headlinePrefix")}{" "}
                  <span className={tone.text}>
                    {t("violations.level.suspended").toLowerCase()}
                  </span>
                </h1>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {t("violations.suspended.description")}{" "}
                  <a
                    href={TERMS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    {t("violations.termsLink")}
                  </a>
                </p>
              </div>
              <SanctionScale level="suspended" className="max-w-xl" />
            </section>

            {/* 2. Ce qui vous est reproché — écrit une seule fois */}
            <section className="mt-10 flex flex-col gap-3">
              <h2 className="text-sm font-semibold">
                {t("violations.suspended.reasonLabel")}
              </h2>
              {loading ? (
                <Skeleton className="h-32 rounded-xl" />
              ) : active.length > 0 ? (
                <div className="flex flex-col gap-3">
                  {active.map((group) => (
                    <ActiveSanction key={group.group_id} group={group} onOpen={setSelected} />
                  ))}
                </div>
              ) : fallback ? (
                <div className="flex flex-col gap-2 rounded-xl border bg-card p-5">
                  <p className="text-base font-medium leading-relaxed">{fallback.reason}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {fallback.action && <GlobalActionChip action={fallback.action} />}
                    <ExpiryLabel
                      expiresAt={fallback.expires_at}
                      className="text-xs text-muted-foreground"
                    />
                    <ReferenceText references={status.sanctions.map((s) => s.reference)} />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-5">
                  <p className="text-sm font-medium">{t("violations.suspended.emptyTitle")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("violations.suspended.emptyDescription")}
                  </p>
                </div>
              )}
            </section>

            {/* 3. Le recours */}
            <section className="mt-10 flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold">{t("violations.detail.appealTitle")}</h2>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  {t("violations.detail.appealDescription")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <a href={APPEAL_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon className="size-4" />
                    {t("violations.appeal")}
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                  <RefreshCwIcon className="size-4" />
                  {t("violations.suspended.recheck")}
                </Button>
              </div>
            </section>

            {/* 4. L'historique — secondaire, et jamais un doublon de ci-dessus */}
            {past.length > 0 && (
              <section className="mt-10 flex flex-col gap-3">
                <h2 className="text-sm font-semibold">
                  {t("violations.suspended.pastRecord")}
                </h2>
                <ViolationList groups={past} loading={false} onOpen={setSelected} />
              </section>
            )}

            {/* 5. Utilitaires — hors du fil de lecture. L'espaceur garantit un
                blanc minimum même quand la page dépasse l'écran, `mt-auto`
                collant le pied en bas quand elle est plus courte. */}
            <div className="h-12 shrink-0" aria-hidden />
            <footer className="mt-auto flex items-center justify-start border-t pt-4">
              <div className="-ml-2">
                <BillingButton />
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
