import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import {
  ShieldIcon,
  UsersIcon,
  ServerIcon,
  AlertTriangleIcon,
  ActivityIcon,
  SearchIcon,
  LoaderIcon,
  BotIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useGuildContext } from "@/contexts/GuildContext"
import { getGlobalStats, getBotStatus, getAllGuilds, searchUsers, getCases } from "@/services/staff"
import type { GlobalStats, BotStatus, UserFullProfile, ModerationCase } from "@/types/api"

// Rôles staff ayant accès aux différentes sections
const CAN_ACCESS_STATS = ['Dev', 'Manager', 'Supervisor_Mod', 'Supervisor_Com', 'Supervisor_Sup']
const CAN_MANAGE_GUILDS = ['Dev', 'Manager', 'Supervisor_Mod']
const CAN_MANAGE_USERS = ['Dev', 'Manager', 'Supervisor_Mod', 'Moderator']
const CAN_VIEW_CASES = ['Dev', 'Manager', 'Supervisor_Mod', 'Supervisor_Com', 'Supervisor_Sup', 'Moderator', 'Support']
const CAN_ACCESS_BOT = ['Dev', 'Manager']

function hasRole(staffRoles: string[], allowedRoles: string[]): boolean {
  return staffRoles.some((r) => allowedRoles.includes(r))
}

// ─── Stats globales ───────────────────────────────────────────────────────────

function StatsTab({ staffRoles }: { staffRoles: string[] }) {
  const { t } = useTranslation()
  const [stats, setStats] = useState<GlobalStats | null>(null)
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, b] = await Promise.all([
        getGlobalStats(),
        hasRole(staffRoles, CAN_ACCESS_BOT) ? getBotStatus() : Promise.resolve(null),
      ])
      setStats(s)
      setBotStatus(b)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load stats'
      setError(msg)
      console.error('[Staff] Failed to load stats:', e)
    } finally {
      setLoading(false)
    }
  }, [staffRoles])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <XCircleIcon className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" size="sm" onClick={load}>
        <RefreshCwIcon className="size-4 mr-1.5" />
        {t('guildOverview.refresh')}
      </Button>
    </div>
  )

  const statCards = stats ? [
    { label: t('staff.stats.totalUsers'), value: stats.total_users.toLocaleString(), icon: UsersIcon, color: 'blue' },
    { label: t('staff.stats.premiumUsers'), value: stats.premium_users.toLocaleString(), icon: TrendingUpIcon, color: 'amber' },
    { label: t('staff.stats.totalGuilds'), value: stats.total_guilds.toLocaleString(), icon: ServerIcon, color: 'purple' },
    { label: t('staff.stats.openCases'), value: stats.open_cases.toLocaleString(), icon: AlertTriangleIcon, color: 'red' },
  ] : []

  return (
    <div className="flex flex-col gap-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={`size-10 rounded-xl bg-${color}-100 dark:bg-${color}-950 flex items-center justify-center shrink-0`}>
                  <Icon className={`size-5 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none">{value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {botStatus && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BotIcon className="size-4" />
              {t('staff.bot.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('staff.bot.shards'), value: botStatus.shards },
              { label: t('staff.bot.latency'), value: `${botStatus.latency}ms` },
              { label: t('staff.bot.uptime'), value: `${Math.floor(botStatus.uptime / 3600)}h ${Math.floor((botStatus.uptime % 3600) / 60)}m` },
              { label: t('staff.bot.memory'), value: `${Math.round(botStatus.memory / 1024 / 1024)} MB` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ─── Utilisateurs ─────────────────────────────────────────────────────────────

function UsersTab() {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [users, setUsers] = useState<UserFullProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const result = await searchUsers(query)
      setUsers(result)
      setSearched(true)
    } catch (e) {
      console.error('[Staff] searchUsers error:', e)
      toast.error('Failed to search users')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('staff.users.searchPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="flex-1"
        />
        <Button onClick={search} disabled={loading} size="icon" variant="secondary">
          {loading ? <LoaderIcon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
        </Button>
      </div>

      {searched && users.length === 0 && !loading && (
        <p className="text-sm text-muted-foreground text-center py-6">No users found for "{query}"</p>
      )}

      {users.length > 0 && (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('staff.users.id')}</TableHead>
                <TableHead>{t('staff.users.email')}</TableHead>
                <TableHead>{t('staff.users.roles')}</TableHead>
                <TableHead>{t('staff.users.cases')}</TableHead>
                <TableHead>{t('staff.users.attributes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-mono text-xs">{u.user_id}</TableCell>
                  <TableCell className="text-sm">{u.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    {u.staff_roles.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {u.staff_roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm tabular-nums">{u.open_cases}/{u.total_cases}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(u.attributes).map(([k, v]) =>
                        v ? (
                          <Badge
                            key={k}
                            variant={k === 'BLACKLISTED' ? 'destructive' : k === 'PREMIUM' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {k}
                          </Badge>
                        ) : null
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

// ─── Serveurs ─────────────────────────────────────────────────────────────────

function GuildsTab() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [guilds, setGuilds] = useState<{ guild_id: string; name?: string; attributes: Record<string, unknown> }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGuilds = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const result = await getAllGuilds({ search: q || undefined, limit: 50 })
      setGuilds(result as unknown as { guild_id: string; name?: string; attributes: Record<string, unknown> }[])
    } catch (e) {
      console.error('[Staff] getAllGuilds error:', e)
      toast.error('Failed to load guilds')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGuilds() }, [fetchGuilds])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('staff.guilds.searchPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && fetchGuilds(search)}
          className="flex-1"
        />
        <Button onClick={() => fetchGuilds(search)} variant="secondary" disabled={loading} size="icon">
          {loading ? <LoaderIcon className="size-4 animate-spin" /> : <RefreshCwIcon className="size-4" />}
        </Button>
      </div>

      {guilds.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('staff.guilds.id')}</TableHead>
                <TableHead>{t('staff.guilds.name')}</TableHead>
                <TableHead>{t('staff.guilds.attributes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guilds.map((g) => (
                <TableRow key={g.guild_id}>
                  <TableCell className="font-mono text-xs">{g.guild_id}</TableCell>
                  <TableCell className="font-medium">{g.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(g.attributes).map(([k, v]) =>
                        v ? (
                          <Badge
                            key={k}
                            variant={k === 'BLACKLISTED' ? 'destructive' : k === 'PREMIUM' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {k}
                          </Badge>
                        ) : null
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : !loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">No guilds found.</p>
      ) : null}
    </div>
  )
}

// ─── Cases ────────────────────────────────────────────────────────────────────

function CasesTab() {
  const { t } = useTranslation()
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getCases({ limit: 50 })
      setCases(result)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load cases'
      setError(msg)
      console.error('[Staff] getCases error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <Skeleton className="h-48 rounded-xl" />

  if (error) return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <XCircleIcon className="size-8 text-destructive" />
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button variant="outline" size="sm" onClick={load}>
        <RefreshCwIcon className="size-4 mr-1.5" />
        {t('guildOverview.refresh')}
      </Button>
    </div>
  )

  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('staff.cases.id')}</TableHead>
            <TableHead>{t('staff.cases.type')}</TableHead>
            <TableHead>{t('staff.cases.entity')}</TableHead>
            <TableHead>{t('staff.cases.status')}</TableHead>
            <TableHead>{t('staff.cases.reason')}</TableHead>
            <TableHead>{t('staff.cases.date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {cases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground py-10">
                {t('staff.cases.empty')}
              </TableCell>
            </TableRow>
          ) : (
            cases.map((c) => (
              <TableRow key={c.case_id}>
                <TableCell className="font-mono text-xs font-medium">{c.case_id}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{c.sanction_type}</Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.entity_type}/{c.entity_id}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={c.status === 'open' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {c.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {c.reason ?? '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground tabular-nums">
                  {new Date(c.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </Card>
  )
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function StaffPage() {
  const { t } = useTranslation()
  const { user } = useGuildContext()
  const [searchParams, setSearchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') ?? 'stats'

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value }, { replace: true })
  }

  if (!user.is_staff) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <ShieldIcon className="size-10 text-muted-foreground" />
          <div>
            <p className="font-semibold">{t('staff.accessDenied.title')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('staff.accessDenied.description')}</p>
          </div>
        </div>
      </div>
    )
  }

  const staffRoles = user.staff_roles

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="size-11 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
          <ShieldIcon className="size-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-semibold leading-none">{t('staff.title')}</h1>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {staffRoles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Onglets selon les permissions — synchronisés avec l'URL */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex-wrap h-auto gap-1">
          {hasRole(staffRoles, CAN_ACCESS_STATS) && (
            <TabsTrigger value="stats" className="gap-1.5">
              <ActivityIcon className="size-3.5" />
              {t('staff.tabs.stats')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_MANAGE_USERS) && (
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="size-3.5" />
              {t('staff.tabs.users')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_MANAGE_GUILDS) && (
            <TabsTrigger value="guilds" className="gap-1.5">
              <ServerIcon className="size-3.5" />
              {t('staff.tabs.guilds')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_VIEW_CASES) && (
            <TabsTrigger value="cases" className="gap-1.5">
              <AlertTriangleIcon className="size-3.5" />
              {t('staff.tabs.cases')}
            </TabsTrigger>
          )}
        </TabsList>

        {hasRole(staffRoles, CAN_ACCESS_STATS) && (
          <TabsContent value="stats" className="mt-5">
            <StatsTab staffRoles={staffRoles} />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_MANAGE_USERS) && (
          <TabsContent value="users" className="mt-5">
            <UsersTab />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_MANAGE_GUILDS) && (
          <TabsContent value="guilds" className="mt-5">
            <GuildsTab />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_VIEW_CASES) && (
          <TabsContent value="cases" className="mt-5">
            <CasesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
