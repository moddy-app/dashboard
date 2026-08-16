import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  ChevronDownIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  LogOutIcon,
  RefreshCwIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { ModdyLogo } from "@/components/moddy-logo"
import { getAvatarUrl, getDisplayName, logout, type User } from "@/lib/auth"
import { usePageTitle } from "@/hooks/usePageTitle"
import { cn } from "@/lib/utils"
import { APPEAL_URL, LEVEL_TONE, formatDeadline } from "@/lib/sanctions"
import { getViolations } from "@/services/violations"
import { getSubscriptionStatus, openBillingPortal } from "@/services/guilds"
import { logger } from "@/lib/logger"
import type { SubscriptionData } from "@/types/api"
import type { SubjectSanctionStatus, ViolationGroup } from "@/types/violations"
import { ViolationList } from "@/components/violations/violation-list"
import { ViolationDetailView } from "@/components/violations/violation-detail"
import { SanctionScale } from "@/components/violations/sanction-scale"
import {
  ActionBadge,
  EnforcementNotice,
  ReferenceText,
} from "@/components/violations/violation-badges"

// ─── Facturation ──────────────────────────────────────────────────────────────

/**
 * Un compte suspendu garde la main sur son argent : le portail Stripe reste
 * accessible pour consulter ses factures ou résilier. Si le back-end refuse
 * malgré tout (`403`), la section disparaît silencieusement plutôt que de
 * promettre une porte fermée.
 */
function BillingSection() {
  const { t } = useTranslation()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    let active = true
    getSubscriptionStatus()
      .then((data) => active && setSubscription(data))
      .catch((e) => logger.warn("sanctions", "Billing unavailable while suspended", e))
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

  // Rien à gérer : ni abonnement, ni client Stripe (donc aucune facture).
  if (!subscription || (!subscription.tier && !subscription.stripe_customer_id)) return null

  return (
    <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <CreditCardIcon className="size-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{t("violations.suspended.billingTitle")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("violations.suspended.billingDescription")}
          </p>
        </div>
      </div>
      <Button variant="outline" onClick={handleOpen} disabled={opening} className="sm:shrink-0">
        <ExternalLinkIcon className="size-4" />
        {t("violations.suspended.billingAction")}
      </Button>
    </section>
  )
}

// ─── Section repliable d'infractions ──────────────────────────────────────────

function RecordSection({
  title,
  groups,
  defaultOpen,
  onOpen,
}: {
  title: string
  groups: ViolationGroup[]
  defaultOpen: boolean
  onOpen: (groupId: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border bg-card">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-5 py-4 text-left transition-colors hover:bg-muted/40 data-[state=open]:rounded-b-none rounded-2xl">
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {groups.length}
        </span>
        <ChevronDownIcon
          className={cn(
            "ml-auto size-4 text-muted-foreground transition-transform",
            open && "rotate-180"
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="border-t p-3">
          <ViolationList groups={groups} loading={false} onOpen={onOpen} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ─── Écran ────────────────────────────────────────────────────────────────────

/**
 * Écran d'un compte suspendu. **Pas un dashboard grisé** : tous les autres
 * appels renverraient 403. Seuls restent joignables `/auth/*`, `/cases*`,
 * `/violations*` et la facturation — c'est exactement ce que cet écran utilise.
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
  const sanction = status.sanctions[0] ?? null
  const expires = formatDeadline(sanction?.expires_at, i18n.language)
  // Le compte à rebours vit sur le groupe, pas sur le statut : on prend celui de
  // l'infraction active la plus récente.
  const enforcement = groups.find((g) => g.active && g.enforcement)?.enforcement ?? null

  const { active, past } = useMemo(
    () => ({
      active: groups.filter((g) => g.active),
      past: groups.filter((g) => !g.active),
    }),
    [groups]
  )

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

      <div className="relative mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-5 py-8 sm:py-12">
        {/* Barre d'identité : le logo dit chez qui on est, le compte dit qui est visé. */}
        <header className="flex items-center justify-between gap-4">
          <ModdyLogo className="h-5 w-auto sm:h-6" />
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
          <ViolationDetailView
            groupId={selected}
            onBack={() => setSelected(null)}
            backLabel={t("violations.suspended.backToSummary")}
          />
        ) : (
          <>
            {/* Verdict + où l'on se situe sur l'échelle des sanctions */}
            <section className="flex flex-col items-center gap-6 text-center">
              <Avatar className={cn("size-20 rounded-full ring-4 ring-offset-4 ring-offset-background", tone.ring)}>
                <AvatarImage
                  src={getAvatarUrl(user.user_id, user.avatar, user.avatar_url)}
                  alt={displayName}
                  referrerPolicy="no-referrer"
                />
                <AvatarFallback className="rounded-full text-lg">
                  {displayName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                  {t("violations.suspended.headlinePrefix")}{" "}
                  <span className={tone.text}>{t("violations.level.suspended").toLowerCase()}</span>
                </h1>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  {t("violations.suspended.description")}
                </p>
              </div>

              <SanctionScale level="suspended" className="mt-2 max-w-lg" />
            </section>

            {/* Motif retenu — la première chose qu'on vient chercher ici */}
            {sanction && (
              <section className={cn("flex flex-col gap-3 rounded-2xl border p-5", tone.border, tone.softBg)}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t("violations.suspended.reasonLabel")}
                </p>
                <p className="text-sm font-medium leading-relaxed">{sanction.reason}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {sanction.action && <ActionBadge action={sanction.action} />}
                  <span className="text-xs text-muted-foreground">
                    {expires
                      ? t("violations.detail.until", { date: expires })
                      : t("violations.detail.permanent")}
                  </span>
                  <ReferenceText references={status.sanctions.map((s) => s.reference)} />
                </div>
              </section>
            )}

            {/* Le compte à rebours précède le bloc d'appel : c'est lui qui donne
                l'urgence, l'appel qui donne la sortie — un seul CTA pour deux. */}
            {enforcement && (
              <EnforcementNotice
                enforcement={enforcement}
                appealUrl={APPEAL_URL}
                showAppeal={false}
              />
            )}

            {/* Recours */}
            <section className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
              <div>
                <p className="text-sm font-semibold">{t("violations.detail.appealTitle")}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("violations.detail.appealDescription")}
                </p>
              </div>
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
            </section>

            <BillingSection />

            {/* Dossier complet — accessible même suspendu */}
            {loading ? (
              <Skeleton className="h-14 rounded-2xl" />
            ) : groups.length === 0 ? (
              // Une suspension implique une infraction active : une liste vide
              // signifie que le chargement a échoué, pas qu'il n'y a rien.
              <div className="rounded-2xl border border-dashed p-5 text-center">
                <p className="text-sm font-medium">{t("violations.suspended.emptyTitle")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("violations.suspended.emptyDescription")}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {active.length > 0 && (
                  <RecordSection
                    title={t("violations.suspended.activeRecord")}
                    groups={active}
                    defaultOpen
                    onOpen={setSelected}
                  />
                )}
                {past.length > 0 && (
                  <RecordSection
                    title={t("violations.suspended.pastRecord")}
                    groups={past}
                    defaultOpen={active.length === 0}
                    onOpen={setSelected}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
