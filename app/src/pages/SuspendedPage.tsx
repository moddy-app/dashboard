import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { CreditCardIcon, ExternalLinkIcon, LogOutIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ModdyLogo } from "@/components/moddy-logo"
import { getAvatarUrl, getDisplayName, logout, type User } from "@/lib/auth"
import { usePageTitle } from "@/hooks/usePageTitle"
import { cn } from "@/lib/utils"
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

// ─── Section ──────────────────────────────────────────────────────────────────

/** Titre de section + contenu — même rythme que les vues `cases`. */
function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

// ─── Facturation ──────────────────────────────────────────────────────────────

/**
 * Un compte suspendu garde la main sur son argent : `POST /stripe/portal` n'est
 * bloqué par aucune sanction — on n'empêche personne de consulter ses factures
 * ni de résilier.
 *
 * `GET /stripe/subscription`, lui, ne figure pas dans les exemptions du niveau
 * « suspendu » : il ne sert donc qu'à **masquer** la section quand il répond et
 * qu'il n'y a effectivement rien à gérer. Tant qu'on n'a pas sa réponse — ou
 * s'il refuse — la section reste affichée : couper l'accès au portail sur la
 * foi d'un endpoint qui n'a peut-être pas le droit de répondre serait le pire
 * des deux mondes.
 */
function BillingSection() {
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

  // Seul cas de masquage : le back-end a répondu, et il n'y a ni abonnement ni
  // client Stripe — donc aucune facture à consulter.
  if (subscription && !subscription.tier && !subscription.stripe_customer_id) return null

  return (
    <Section title={t("violations.suspended.billingTitle")}>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <CreditCardIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            {t("violations.suspended.billingDescription")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleOpen} disabled={opening} className="sm:shrink-0">
          <ExternalLinkIcon className="size-4" />
          {t("violations.suspended.billingAction")}
        </Button>
      </div>
    </Section>
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
  const sanction = status.sanctions[0] ?? null
  // Le compte à rebours vit sur le groupe, pas sur le statut : on prend celui de
  // l'infraction encore active la plus récente.
  const activeGroup = groups.find((g) => g.active && g.enforcement) ?? null

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

      <div className="relative mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-5 py-8 sm:py-12">
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
          <ViolationDetailView
            groupId={selected}
            onBack={() => setSelected(null)}
            backLabel={t("violations.suspended.backToSummary")}
          />
        ) : (
          <>
            {/* Verdict — aligné à gauche comme tout le reste de la page. */}
            <section className="flex flex-col gap-6">
              <div className="flex items-start gap-4">
                <Avatar className={cn("size-14 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-background", tone.ring)}>
                  <AvatarImage
                    src={getAvatarUrl(user.user_id, user.avatar, user.avatar_url)}
                    alt={displayName}
                    referrerPolicy="no-referrer"
                  />
                  <AvatarFallback className="rounded-full text-sm">
                    {displayName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <h1 className="text-2xl font-semibold leading-tight tracking-tight">
                    {t("violations.suspended.headlinePrefix")}{" "}
                    <span className={tone.text}>
                      {t("violations.level.suspended").toLowerCase()}
                    </span>
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
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
              </div>

              <div className="rounded-xl border bg-card p-4">
                <p className="mb-4 text-sm font-semibold">{t("violations.scaleTitle")}</p>
                <SanctionScale level="suspended" />
              </div>
            </section>

            {/* Ce qui nous est reproché */}
            {sanction && (
              <Section title={t("violations.suspended.reasonLabel")}>
                {/* Volontairement neutre : le rouge est réservé au bloc qui
                    annonce des conséquences à venir. Deux cartes rouges à la
                    suite ne hiérarchisent plus rien. */}
                <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                  <p className="text-sm leading-relaxed">{sanction.reason}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {sanction.action && <GlobalActionChip action={sanction.action} />}
                    <ExpiryLabel
                      expiresAt={sanction.expires_at}
                      className="text-xs text-muted-foreground"
                    />
                    <ReferenceText references={status.sanctions.map((s) => s.reference)} />
                  </div>
                </div>
              </Section>
            )}

            {/* Ce qui va se passer — jamais sur une infraction déjà levée. */}
            {activeGroup?.enforcement && (
              <EnforcementNotice
                enforcement={activeGroup.enforcement}
                appealUrl={APPEAL_URL}
                active
                showAppeal={false}
              />
            )}

            {/* Recours */}
            <Section
              title={t("violations.detail.appealTitle")}
              description={t("violations.detail.appealDescription")}
            >
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
            </Section>

            <BillingSection />

            {/* Historique complet — consultable même suspendu. */}
            <Section
              title={t("violations.suspended.activeRecord")}
              description={t("violations.suspended.activeRecordDescription")}
            >
              <ViolationList
                groups={active}
                loading={loading}
                onOpen={setSelected}
                emptyTitle={t("violations.suspended.emptyTitle")}
                emptyDescription={t("violations.suspended.emptyDescription")}
              />
            </Section>

            {past.length > 0 && (
              <Section
                title={t("violations.suspended.pastRecord")}
                description={t("violations.suspended.pastRecordDescription")}
              >
                <ViolationList groups={past} loading={false} onOpen={setSelected} />
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
