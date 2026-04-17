import { useTranslation } from "react-i18next"
import { ArrowUpRightIcon, PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { getGuildIconUrl } from "@/lib/auth"
import { ServerIcon } from "lucide-react"

export function GuildSelectionView() {
  const { t } = useTranslation()
  const { guilds, selectGuild } = useGuildContext()

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
        <p className="text-sm text-muted-foreground mt-1">
          {t('guildSelection.description')}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {guilds.map((guild) => {
          const iconUrl = getGuildIconUrl(guild.id, guild.icon)
          const initials = guild.name?.slice(0, 2)?.toUpperCase() ?? '??'

          return (
            <Card
              key={guild.id}
              className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground group"
              onClick={() => selectGuild(String(guild.id))}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <Avatar className="size-10 rounded-lg">
                  <AvatarImage src={iconUrl ?? undefined} alt={guild.name} />
                  <AvatarFallback className="rounded-lg text-sm font-medium">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{guild.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('guildSelection.manage')}
                  </p>
                </div>
                <ArrowUpRightIcon className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </CardContent>
            </Card>
          )
        })}

        {/* Carte "Ajouter Moddy" */}
        <Card
          className="cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground border-dashed"
          onClick={() =>
            window.open(
              "https://discord.com/oauth2/authorize?client_id=1373916203814490194",
              "_blank",
              "noopener,noreferrer"
            )
          }
        >
          <CardContent className="flex items-center gap-3 p-4">
            <div className="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <PlusIcon className="size-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-muted-foreground">
                {t('dashboard.noServer.addModdy')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('guildSelection.addDescription')}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
