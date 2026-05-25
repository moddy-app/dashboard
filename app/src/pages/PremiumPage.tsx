import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  CrownIcon,
  CheckIcon,
  SparklesIcon,
  LoaderIcon,
  BotIcon,
  ServerIcon,
  SmartphoneIcon,
  BrainCircuitIcon,
  ZapIcon,
  BadgeIcon,
  HeadphonesIcon,
  ExternalLinkIcon,
  StarIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGuildContext } from "@/contexts/GuildContext"
import { createCheckout, openBillingPortal } from "@/services/guilds"
import { handleSaveError } from "@/lib/handle-error"
import { getGuildIconUrl } from "@/lib/auth"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { usePageTitle } from "@/hooks/usePageTitle"
import type { LucideIcon } from "lucide-react"

// ─── Feature row ──────────────────────────────────────────────────────────────

interface FeatureRowProps {
  icon: LucideIcon
  label: string
  available: boolean
}

function FeatureRow({ icon: Icon, label, available }: FeatureRowProps) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`size-7 rounded-md flex items-center justify-center shrink-0 ${
          available
            ? "bg-amber-100 dark:bg-amber-950"
            : "bg-muted"
        }`}
      >
        <Icon
          className={`size-3.5 ${
            available
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground"
          }`}
        />
      </div>
      <span
        className={`text-sm leading-tight ${
          available ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
      {available && (
        <CheckIcon className="ml-auto size-4 text-amber-500 shrink-0" />
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PremiumPage() {
  const { t } = useTranslation()
  const { guilds, selectedGuildId, guildDetail, stats } = useGuildContext()
  usePageTitle(t("pageTitle.premium"))

  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly")
  const [upgradeGuildId, setUpgradeGuildId] = useState<string>(selectedGuildId ?? "")
  const [isLoadingCheckout, setIsLoadingCheckout] = useState(false)
  const [isLoadingPortal, setIsLoadingPortal] = useState(false)

  const isPremiumCurrentGuild =
    guildDetail?.attributes?.PREMIUM === true || stats?.is_premium === true

  const selectedGuildIsPremium =
    upgradeGuildId === selectedGuildId && isPremiumCurrentGuild

  const maxFeatures: { icon: LucideIcon; key: string }[] = [
    { icon: BotIcon, key: "botCustomization" },
    { icon: ServerIcon, key: "multiServer" },
    { icon: SmartphoneIcon, key: "personalApp" },
    { icon: BrainCircuitIcon, key: "aiLimits" },
    { icon: ZapIcon, key: "earlyAccess" },
    { icon: BadgeIcon, key: "premiumRole" },
    { icon: HeadphonesIcon, key: "prioritySupport" },
  ]

  const freeFeatures: { icon: LucideIcon; key: string }[] = [
    { icon: ServerIcon, key: "basicModules" },
    { icon: BrainCircuitIcon, key: "standardAi" },
    { icon: HeadphonesIcon, key: "communitySupport" },
  ]

  const handleUpgrade = async () => {
    if (!upgradeGuildId) return
    setIsLoadingCheckout(true)
    try {
      const url = await createCheckout(upgradeGuildId, billingPeriod)
      window.location.href = url
    } catch (e) {
      handleSaveError(e, { title: t("premium.serverUpgrade.checkoutError") })
      setIsLoadingCheckout(false)
    }
  }

  const handleOpenPortal = async () => {
    setIsLoadingPortal(true)
    try {
      const url = await openBillingPortal()
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (e) {
      handleSaveError(e, { title: t("premium.serverUpgrade.portalError") })
    } finally {
      setIsLoadingPortal(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-4xl mx-auto">

      {/* ── En-tête ───────────────────────────────────────────────────────── */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="size-12 rounded-2xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
          <CrownIcon className="size-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("premium.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("premium.subtitle")}</p>
        </div>

        {/* Toggle mensuel / annuel */}
        <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
          <button
            onClick={() => setBillingPeriod("monthly")}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              billingPeriod === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("premium.billing.monthly")}
          </button>
          <button
            onClick={() => setBillingPeriod("yearly")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
              billingPeriod === "yearly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("premium.billing.yearly")}
            <Badge className="text-[10px] px-1.5 py-0 bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
              {t("premium.billing.yearlyDiscount")}
            </Badge>
          </button>
        </div>
      </div>

      {/* ── Cartes plans ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* Plan Free */}
        <Card className="py-0 flex flex-col">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <StarIcon className="size-5 text-muted-foreground" />
                <span className="text-lg font-semibold">{t("premium.plans.free.name")}</span>
              </div>
              <Badge variant="secondary" className="text-xs">
                {t("premium.plans.free.badge")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("premium.plans.free.description")}</p>
          </CardHeader>
          <CardContent className="px-6 pb-4 flex-1">
            <Separator className="mb-4" />
            <div className="flex flex-col gap-3">
              {freeFeatures.map(({ icon, key }) => (
                <FeatureRow
                  key={key}
                  icon={icon}
                  label={t(`premium.freeFeatures.${key}`)}
                  available={false}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
            <Button variant="outline" className="w-full" disabled>
              {t("premium.plans.free.cta")}
            </Button>
          </CardFooter>
        </Card>

        {/* Plan Max */}
        <Card className="py-0 flex flex-col border-amber-400/60 dark:border-amber-600/40 bg-amber-400/5 dark:bg-amber-900/10 shadow-sm">
          <CardHeader className="p-6 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <CrownIcon className="size-5 text-amber-600 dark:text-amber-400" />
                <span className="text-lg font-semibold">{t("premium.plans.max.name")}</span>
              </div>
              <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
                {t("premium.plans.max.badge")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{t("premium.plans.max.description")}</p>
          </CardHeader>
          <CardContent className="px-6 pb-4 flex-1">
            <Separator className="mb-4 bg-amber-200/50 dark:bg-amber-800/30" />
            <div className="flex flex-col gap-3">
              {maxFeatures.map(({ icon, key }) => (
                <FeatureRow
                  key={key}
                  icon={icon}
                  label={t(`premium.features.${key}`)}
                  available={true}
                />
              ))}
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
            <Button
              className="w-full bg-amber-500 hover:bg-amber-600 text-white shadow-sm"
              onClick={() => document.getElementById("server-upgrade-section")?.scrollIntoView({ behavior: "smooth" })}
            >
              <SparklesIcon className="size-4" />
              {t("premium.plans.max.cta")}
            </Button>
          </CardFooter>
        </Card>
      </div>

      {/* ── Mettre un serveur à niveau ──────────────────────────────────── */}
      <Card id="server-upgrade-section" className="py-0">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-base font-semibold">{t("premium.serverUpgrade.title")}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {t("premium.serverUpgrade.description")}
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Select
                value={upgradeGuildId}
                onValueChange={setUpgradeGuildId}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("premium.serverUpgrade.selectPlaceholder")}>
                    {upgradeGuildId && (() => {
                      const guild = guilds.find((g) => String(g.id) === upgradeGuildId)
                      if (!guild) return t("premium.serverUpgrade.selectPlaceholder")
                      const iconUrl = getGuildIconUrl(String(guild.id), guild.icon)
                      return (
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5 rounded-md">
                            <AvatarImage src={iconUrl ?? undefined} referrerPolicy="no-referrer" />
                            <AvatarFallback className="rounded-md text-[10px]">
                              {guild.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{guild.name}</span>
                        </div>
                      )
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {guilds.map((guild) => {
                    const iconUrl = getGuildIconUrl(String(guild.id), guild.icon)
                    return (
                      <SelectItem key={String(guild.id)} value={String(guild.id)}>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5 rounded-md">
                            <AvatarImage src={iconUrl ?? undefined} referrerPolicy="no-referrer" />
                            <AvatarFallback className="rounded-md text-[10px]">
                              {guild.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{guild.name}</span>
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {selectedGuildIsPremium ? (
                <Button variant="outline" disabled className="shrink-0">
                  <CheckIcon className="size-4 text-amber-500" />
                  {t("premium.serverUpgrade.alreadyPremium")}
                </Button>
              ) : (
                <Button
                  className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
                  onClick={handleUpgrade}
                  disabled={isLoadingCheckout || !upgradeGuildId}
                >
                  {isLoadingCheckout ? (
                    <LoaderIcon className="size-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="size-4" />
                  )}
                  {isLoadingCheckout
                    ? t("premium.plans.max.ctaLoading")
                    : t("premium.plans.max.cta")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Portail de facturation ────────────────────────────────────────── */}
      <Card className="py-0 border-dashed">
        <CardContent className="p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-base font-semibold">
                {t("premium.serverUpgrade.portalTitle")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                {t("premium.serverUpgrade.portalDescription")}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleOpenPortal}
              disabled={isLoadingPortal}
              className="shrink-0"
            >
              {isLoadingPortal ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <ExternalLinkIcon className="size-4" />
              )}
              {isLoadingPortal
                ? t("premium.plans.max.manageCtaLoading")
                : t("premium.serverUpgrade.portalCta")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
