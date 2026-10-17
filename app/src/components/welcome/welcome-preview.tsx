import { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { DiscordMarkup } from "@/components/discord-markup"
import { useGuildContext } from "@/contexts/GuildContext"
import { formatDiscordTimestamps, renderWelcomeDmPreview } from "@/lib/welcome-dm"
import { cn } from "@/lib/utils"

interface WelcomeMessagePreviewProps {
  message: string
  className?: string
}

/**
 * Aperçu rendu d'un message de bienvenue (salon ou DM), limité à 3 lignes :
 * placeholders substitués littéralement, balises `<t:…>` lisibles, puis
 * markdown Discord. `Date.now()` est figé au montage (rendu pur).
 */
export function WelcomeMessagePreview({ message, className }: WelcomeMessagePreviewProps) {
  const { t, i18n } = useTranslation()
  const { guildDetail, user } = useGuildContext()
  const [joinedAt] = useState(() => Date.now())

  const rendered = useMemo(() => {
    const displayName = user.global_name || user.username
    const substituted = renderWelcomeDmPreview(message, {
      server: guildDetail?.name ?? t("modules.welcome_dm.previewServer"),
      user: `@${displayName}`,
      display_name: displayName,
      username: user.username,
      member_count: String(guildDetail?.member_count ?? 1),
      timestamp: String(Math.floor(joinedAt / 1000)),
    })
    return formatDiscordTimestamps(substituted, i18n.language, joinedAt)
  }, [message, guildDetail, user, i18n.language, joinedAt, t])

  return (
    <div
      className={cn(
        "line-clamp-3 min-w-0 break-words text-xs text-muted-foreground",
        "[&_h1]:text-sm [&_h1]:font-semibold [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-xs [&_h3]:font-semibold",
        "[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-2",
        "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:font-mono",
        className
      )}
    >
      <DiscordMarkup text={rendered} />
    </div>
  )
}
