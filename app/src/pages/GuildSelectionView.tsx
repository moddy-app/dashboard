import { useTranslation } from "react-i18next"
import { ArrowUpRightIcon, PlusIcon, CrownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent } from "@/components/ui/card"
import { useGuildContext } from "@/contexts/GuildContext"
import { usePremiumGuilds } from "@/hooks/usePremiumGuilds"
import { useGuildAttributes } from "@/hooks/useGuildAttributes"
import { VerifiedBadge } from "@/components/verified-badge"
import { resolveVerifiedKind } from "@/lib/verified"
import { getGuildIconUrl } from "@/lib/auth"
import { ServerIcon } from "lucide-react"

export function GuildSelectionView() {
  const { t } = useTranslation()
  const { guilds, selectGuild } = useGuildContext()
  const premiumIds = usePremiumGuilds()
  const guildAttributes = useGuildAttributes()

  if (guilds.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[60vh]">
        <Empty className="border border-dashed max-w-md">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerIcon />
            </EmptyMedia>
            <EmptyTitle>{t('dashboard.noServer.title')}</EmptyTitle>
            <EmptyDescription>
              {t('dashboard.noServer.description')}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent className="flex-row justify-center gap-2">
            <Button
              onClick={() =>
                window.open(
                  "https://discord.com/oauth2/authorize?client_id=1373916203814490194",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              <PlusIcon className="size-4" />
              {t('dashboard.noServer.addModdy')}
            </Button>
          </EmptyContent>
          <Button variant="link" asChild className="text-muted-foreground" size="sm">
            <a href="https://docs.moddy.app" target="_blank" rel="noopener noreferrer">
              {t('dashboard.noServer.learnMore')} <ArrowUpRightIcon className="size-3" />
            </a>
          </Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('guildSelection.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          {t('guildSelection.description')}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {guilds.map((guild) => {
          const iconUrl = getGuildIconUrl(guild.id, guild.icon)
          const initials = guild.name?.slice(0, 2)?.toUpperCase() ?? '??'
          const kind = resolveVerifiedKind(guildAttributes.get(String(guild.id)), undefined)
          // Les serveurs officiels n'affichent pas d'indicateur Max.
          const showMax = premiumIds.has(String(guild.id)) && kind !== 'official'

          return (
            <Card
              key={guild.id}
              className="cursor-pointer transition-all hover:border-primary/30 hover:shadow-sm group py-0"
              onClick={() => selectGuild(String(guild.id))}
            >
              <CardContent className="flex items-center gap-3.5 p-5">
                <Avatar className="size-11 rounded-xl shrink-0 after:rounded-xl">
                  <AvatarImage
                    src={iconUrl ?? undefined}
                    alt={guild.name}
                    referrerPolicy="no-referrer"
                    className="rounded-xl"
                    onError={() => console.warn('[avatar] GuildSelection failed to load', guild.id, iconUrl)}
                  />
                  <AvatarFallback className="rounded-xl text-sm font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <p className="font-semibold truncate">{guild.name}</p>
                    {kind && <VerifiedBadge kind={kind} className="-ml-1 shrink-0" />}
                    {showMax && (
                      <Badge className="shrink-0 gap-0.5 px-1.5 py-0 text-[10px] bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800">
                        <CrownIcon className="size-2.5" />
                        Max
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('guildSelection.manage')}
                  </p>
                </div>
                <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
              </CardContent>
            </Card>
          )
        })}

        {/* Carte "Ajouter Moddy" */}
        <Card
          className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm border-dashed group py-0"
          onClick={() =>
            window.open(
              "https://discord.com/oauth2/authorize?client_id=1373916203814490194",
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          <CardContent className="flex items-center gap-3.5 p-5">
            <div className="size-11 rounded-xl bg-muted flex items-center justify-center shrink-0 transition-colors group-hover:bg-background">
              <PlusIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-muted-foreground">
                {t('dashboard.noServer.addModdy')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('guildSelection.addDescription')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
