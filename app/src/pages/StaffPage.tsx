import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
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
} from "lucide-react"
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

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [s, b] = await Promise.all([
          getGlobalStats(),
          hasRole(staffRoles, CAN_ACCESS_BOT) ? getBotStatus() : Promise.resolve(null),
        ])
        setStats(s)
        setBotStatus(b)
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [staffRoles])

  if (loading) return <Skeleton className="h-64 rounded-xl" />

  return (
    <div className="flex flex-col gap-4">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: t('staff.stats.totalUsers'), value: stats.total_users, icon: UsersIcon, color: 'blue' },
            { label: t('staff.stats.premiumUsers'), value: stats.premium_users, icon: TrendingUpIcon, color: 'amber' },
            { label: t('staff.stats.totalGuilds'), value: stats.total_guilds, icon: ServerIcon, color: 'purple' },
            { label: t('staff.stats.openCases'), value: stats.open_cases, icon: AlertTriangleIcon, color: 'red' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`size-9 rounded-lg bg-${color}-100 dark:bg-${color}-950 flex items-center justify-center`}>
                  <Icon className={`size-5 text-${color}-600 dark:text-${color}-400`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {botStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BotIcon className="size-4" />
              {t('staff.bot.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{t('staff.bot.shards')}</p>
              <p className="font-medium">{botStatus.shards}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('staff.bot.latency')}</p>
              <p className="font-medium">{botStatus.latency}ms</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('staff.bot.uptime')}</p>
              <p className="font-medium">
                {Math.floor(botStatus.uptime / 3600)}h{' '}
                {Math.floor((botStatus.uptime % 3600) / 60)}m
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t('staff.bot.memory')}</p>
              <p className="font-medium">{Math.round(botStatus.memory / 1024 / 1024)} MB</p>
            </div>
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

  const search = async () => {
    if (!query.trim()) return
    setLoading(true)
    try {
      const result = await searchUsers(query)
      setUsers(result)
    } catch {
      // silent
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
        <Button onClick={search} disabled={loading}>
          {loading ? <LoaderIcon className="size-4 animate-spin" /> : <SearchIcon className="size-4" />}
        </Button>
      </div>

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
                  <TableCell>{u.email ?? <span className="text-muted-foreground">—</span>}</TableCell>
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
                    <span className="text-sm">{u.open_cases}/{u.total_cases}</span>
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
  const [guilds, setGuilds] = useState<{ guild_id: number; name?: string; attributes: Record<string, unknown> }[]>([])
  const [loading, setLoading] = useState(false)

  const fetchGuilds = async () => {
    setLoading(true)
    try {
      const result = await getAllGuilds({ search: search || undefined, limit: 50 })
      setGuilds(result as unknown as { guild_id: number; name?: string; attributes: Record<string, unknown> }[])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchGuilds()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('staff.guilds.searchPlaceholder')}
          onKeyDown={(e) => e.key === 'Enter' && fetchGuilds()}
          className="flex-1"
        />
        <Button onClick={fetchGuilds} variant="outline" disabled={loading}>
          <RefreshCwIcon className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {guilds.length > 0 && (
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
                  <TableCell>{g.name ?? '—'}</TableCell>
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
      )}
    </div>
  )
}

// ─── Cases ────────────────────────────────────────────────────────────────────

function CasesTab() {
  const { t } = useTranslation()
  const [cases, setCases] = useState<ModerationCase[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCases({ limit: 50 })
      .then(setCases)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Skeleton className="h-48 rounded-xl" />

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
              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                {t('staff.cases.empty')}
              </TableCell>
            </TableRow>
          ) : (
            cases.map((c) => (
              <TableRow key={c.case_id}>
                <TableCell className="font-mono text-xs">{c.case_id}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-xs">{c.sanction_type}</Badge>
                </TableCell>
                <TableCell className="text-xs">
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
                <TableCell className="max-w-[200px] truncate text-xs">
                  {c.reason}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
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

  if (!user.is_staff) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[40vh]">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <ShieldIcon className="size-10 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('staff.accessDenied.title')}</p>
            <p className="text-sm text-muted-foreground">{t('staff.accessDenied.description')}</p>
          </div>
        </div>
      </div>
    )
  }

  const staffRoles = user.staff_roles

  return (
    <div className="flex flex-col gap-6">
      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
          <ShieldIcon className="size-5 text-red-600 dark:text-red-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('staff.title')}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {staffRoles.map((role) => (
              <Badge key={role} variant="secondary" className="text-xs">{role}</Badge>
            ))}
          </div>
        </div>
      </div>

      <Separator />

      {/* Onglets selon les permissions */}
      <Tabs defaultValue="stats">
        <TabsList>
          {hasRole(staffRoles, CAN_ACCESS_STATS) && (
            <TabsTrigger value="stats">
              <ActivityIcon className="size-4 mr-1.5" />
              {t('staff.tabs.stats')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_MANAGE_USERS) && (
            <TabsTrigger value="users">
              <UsersIcon className="size-4 mr-1.5" />
              {t('staff.tabs.users')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_MANAGE_GUILDS) && (
            <TabsTrigger value="guilds">
              <ServerIcon className="size-4 mr-1.5" />
              {t('staff.tabs.guilds')}
            </TabsTrigger>
          )}
          {hasRole(staffRoles, CAN_VIEW_CASES) && (
            <TabsTrigger value="cases">
              <AlertTriangleIcon className="size-4 mr-1.5" />
              {t('staff.tabs.cases')}
            </TabsTrigger>
          )}
        </TabsList>

        {hasRole(staffRoles, CAN_ACCESS_STATS) && (
          <TabsContent value="stats" className="mt-4">
            <StatsTab staffRoles={staffRoles} />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_MANAGE_USERS) && (
          <TabsContent value="users" className="mt-4">
            <UsersTab />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_MANAGE_GUILDS) && (
          <TabsContent value="guilds" className="mt-4">
            <GuildsTab />
          </TabsContent>
        )}
        {hasRole(staffRoles, CAN_VIEW_CASES) && (
          <TabsContent value="cases" className="mt-4">
            <CasesTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
