import * as React from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon, ServerIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CaseDetailView } from "@/components/cases/case-detail-view"
import { CasesScreen } from "@/components/cases/cases-screen"
import { GuildInline } from "@/components/cases/actor"

const RECENT_KEY = "moddy-recent-guilds"

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function pushRecent(guildId: string) {
  const list = [guildId, ...loadRecent().filter((g) => g !== guildId)].slice(0, 6)
  localStorage.setItem(RECENT_KEY, JSON.stringify(list))
}

export function ServersLandingPage() {
  const navigate = useNavigate()
  const [value, setValue] = React.useState("")
  const recent = loadRecent()

  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const id = value.trim()
    if (!/^\d{5,}$/.test(id)) return
    navigate(`/servers/${id}`)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl px-6 py-10">
        <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/40">
          <ServerIcon className="size-5 text-muted-foreground" />
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          Modération de serveur
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez et gérez les cases scopées sur un serveur que vous
          administrez. Saisissez l'identifiant du serveur pour continuer.
        </p>

        <form onSubmit={go} className="mt-6 flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="ID du serveur (guild_id)…"
            inputMode="numeric"
            className="font-mono"
          />
          <Button type="submit" disabled={!/^\d{5,}$/.test(value.trim())}>
            Ouvrir
          </Button>
        </form>

        {recent.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Récents
            </p>
            <div className="mt-2 space-y-1">
              {recent.map((gid) => (
                <Link
                  key={gid}
                  to={`/servers/${gid}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 transition-colors hover:bg-muted/50"
                >
                  <GuildInline guildId={gid} size="md" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {gid}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ServerCasesPage() {
  const { guildId } = useParams()

  React.useEffect(() => {
    if (guildId) pushRecent(guildId)
  }, [guildId])

  return (
    <CasesScreen
      key={guildId}
      title="Cases du serveur"
      headerExtra={
        <div className="mb-2 flex items-center gap-3">
          <Button asChild variant="ghost" size="icon-sm" className="-ml-1">
            <Link to="/servers" aria-label="Retour aux serveurs">
              <ArrowLeftIcon />
            </Link>
          </Button>
          {guildId && <GuildInline guildId={guildId} size="lg" />}
        </div>
      }
      description="Toutes les cases scopées sur ce serveur."
      baseQuery={{ scope_type: "discord_guild", scope_id: guildId }}
      filterFields={["status", "type", "action", "subject"]}
      buildTo={(c) => `/servers/${guildId}/${c.reference}`}
      showSubject
      showScope={false}
      emptyTitle="Aucune case"
      emptyHint="Aucune case n'est enregistrée pour ce serveur, ou il est hors de votre périmètre."
    />
  )
}

export function ServerCaseDetailPage() {
  const { guildId, reference } = useParams()
  return (
    <CaseDetailView
      identifier={reference!}
      backTo={`/servers/${guildId}`}
      backLabel="Cases du serveur"
    />
  )
}
