import { useTranslation } from "react-i18next"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowUpRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { LEVEL_TONE, VIOLATIONS_PATH, formatDeadline } from "@/lib/sanctions"
import { useGuildContext } from "@/contexts/GuildContext"
import { useSanctionGates } from "@/contexts/SanctionContext"
import type { SanctionLevel, SubjectSanctionStatus } from "@/types/violations"

// ─── Bandeau générique ────────────────────────────────────────────────────────

export function SanctionNotice({
  level,
  title,
  description,
  status,
  className,
  compact = false,
}: {
  level: SanctionLevel
  title: string
  description: string
  /** Sanction à l'origine du blocage — alimente références et échéance. */
  status?: SubjectSanctionStatus | null
  className?: string
  compact?: boolean
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const tone = LEVEL_TONE[level]
  const Icon = tone.icon

  const references = status?.sanctions.map((s) => s.reference) ?? []
  const expires = formatDeadline(status?.sanctions[0]?.expires_at, i18n.language)

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4",
        tone.border,
        tone.softBg,
        className
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone.text)} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold", tone.text)}>{title}</p>
        {!compact && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {references.length > 0 && (
            <span className="font-mono tracking-wide">{references.join(" · ")}</span>
          )}
          {expires && <span>{t("violations.banner.until", { date: expires })}</span>}
          <button
            type="button"
            onClick={() => navigate(VIOLATIONS_PATH)}
            className="inline-flex items-center gap-0.5 font-medium text-foreground underline-offset-2 hover:underline"
          >
            {t("violations.banner.seeDetails")}
            <ArrowUpRightIcon className="size-3" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Bandeau contextuel du dashboard ──────────────────────────────────────────

/**
 * Décide seul de ce qu'il faut dire selon la route : un serveur suspendu, un
 * module non configuré qu'on ne peut plus activer, un automod IA coupé, ou une
 * simple limitation du compte. Un `warn` n'affiche jamais rien — il ne bloque
 * rien, un bandeau serait un faux positif.
 */
export function DashboardSanctionBanner() {
  const { t } = useTranslation()
  const location = useLocation()
  const { selectedGuildId, modules, guildDetail } = useGuildContext()
  const gates = useSanctionGates(selectedGuildId)

  const onGuildRoute = Boolean(selectedGuildId) && location.pathname.startsWith("/servers/")
  const moduleId = location.pathname.match(/^\/servers\/\d+\/modules\/(.+)$/)?.[1] ?? null
  const guildName = guildDetail?.name ?? ""

  // Serveur suspendu — plus rien n'est accessible dessus.
  if (onGuildRoute && gates.guildSuspended) {
    return (
      <SanctionNotice
        level="suspended"
        status={gates.guild}
        title={t("violations.banner.guildSuspendedTitle")}
        description={t("violations.banner.guildSuspendedDescription", { guild: guildName })}
      />
    )
  }

  // Automod IA : suit le **serveur**, jamais l'utilisateur.
  if (moduleId === "automod_ai" && !gates.canWriteAutomod) {
    return (
      <SanctionNotice
        level="limited"
        status={gates.guild}
        title={t("violations.banner.automodBlockedTitle")}
        description={t("violations.banner.automodBlockedDescription")}
      />
    )
  }

  // Module pas encore configuré → activation refusée. Un module déjà configuré
  // reste pleinement modifiable : on n'affiche rien dans ce cas.
  if (moduleId && !gates.canEnableNewModule && !modules[moduleId]) {
    return (
      <SanctionNotice
        level={gates.effective.level === "none" ? "limited" : gates.effective.level}
        status={gates.effective}
        title={t("violations.banner.newModuleBlockedTitle")}
        description={t("violations.banner.newModuleBlockedDescription")}
      />
    )
  }

  // Serveur limité (hors page de module) — informatif.
  if (onGuildRoute && !moduleId && !gates.canWriteAutomod) {
    return (
      <SanctionNotice
        level="limited"
        status={gates.guild}
        title={t("violations.banner.guildLimitedTitle")}
        description={t("violations.banner.guildLimitedDescription", { guild: guildName })}
      />
    )
  }

  // Compte limité — affiché une fois, sur la vue d'ensemble et la sélection.
  const onOverview = location.pathname === "/" || location.pathname === `/servers/${selectedGuildId}`
  if (onOverview && gates.user.restricted) {
    return (
      <SanctionNotice
        level={gates.user.level}
        status={gates.user}
        title={t("violations.banner.userLimitedTitle")}
        description={t("violations.banner.userLimitedDescription")}
      />
    )
  }

  return null
}
