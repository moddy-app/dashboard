import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router-dom"
import {
  ShieldIcon,
  UsersIcon,
  ServerIcon,
  AlertTriangleIcon,
  SearchIcon,
  LoaderIcon,
  BotIcon,
  TrendingUpIcon,
  RefreshCwIcon,
  XCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { Field, FieldTitle, FieldDescription } from "@/components/ui/field"
import { Separator } from "@/components/ui/separator"
import { useGuildContext } from "@/contexts/GuildContext"
import { getGlobalStats, getBotStatus, getAllGuilds, searchUsers, getCases, getTallyForms, getTallySubmissions, getTallySubmission, updateTallySubmission } from "@/services/staff"
import type { GlobalStats, BotStatus, UserFullProfile, ModerationCase, TallyForm, TallySubmissionsResponse, TallySubmissionDetail, TallySubmissionStatus } from "@/types/api"

// Rôles staff ayant accès aux différentes sections
const CAN_ACCESS_STATS = ['Dev', 'Manager', 'Supervisor_Mod', 'Supervisor_Com', 'Supervisor_Sup']
const CAN_MANAGE_GUILDS = ['Dev', 'Manager', 'Supervisor_Mod']
const CAN_MANAGE_USERS = ['Dev', 'Manager', 'Supervisor_Mod', 'Moderator']
const CAN_VIEW_CASES = ['Dev', 'Manager', 'Supervisor_Mod', 'Supervisor_Com', 'Supervisor_Sup', 'Moderator', 'Support']
const CAN_ACCESS_BOT = ['Dev', 'Manager']
const CAN_ACCESS_FORMS = ['Dev', 'Manager', 'Supervisor_Mod', 'Supervisor_Com', 'Supervisor_Sup']

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
    { label: t('staff.stats.openCases'), value: stats.open_cases.toLocaleString(), icon: AlertTriangleIcon, color: 'orange' },
  ] : []

  return (
    <div className="flex flex-col gap-6">
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="py-0">
              <CardContent className="flex items-center gap-4 p-6">
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
                      {Object.entries(g.attributes).map(([k, v]) => {
                        if (!v) return null
                        if (k === 'BLACKLISTED') return (
                          <Badge key={k} variant="destructive" className="text-xs">{k}</Badge>
                        )
                        if (k === 'PREMIUM') return (
                          <Badge key={k} className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">Max</Badge>
                        )
                        if (k === 'OFFICIAL_SERVER') return (
                          <Badge key={k} variant="outline" className="text-xs text-blue-600 border-blue-300 dark:text-blue-400 dark:border-blue-700">Official</Badge>
                        )
                        return null
                      })}
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

// ─── Formulaires / Candidatures ───────────────────────────────────────────────

const HIDDEN_FIELD_LABELS = ['session', 'discord_id', 'email']

type FormsView =
  | { type: 'list' }
  | { type: 'submissions'; formId: string; formTitle: string }
  | { type: 'detail'; submissionId: string; formId: string; formTitle: string }

function StatusBadge({ status }: { status: TallySubmissionStatus }) {
  const { t } = useTranslation()
  if (status === 'done') return (
    <Badge className="text-xs bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
      {t('staff.forms.statusLabel.done')}
    </Badge>
  )
  if (status === 'rejected') return (
    <Badge variant="destructive" className="text-xs">
      {t('staff.forms.statusLabel.rejected')}
    </Badge>
  )
  return (
    <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800">
      {t('staff.forms.statusLabel.pending')}
    </Badge>
  )
}

function FormsList({ onSelect }: { onSelect: (form: TallyForm) => void }) {
  const { t } = useTranslation()
  const [forms, setForms] = useState<TallyForm[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newFormId, setNewFormId] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newSecret, setNewSecret] = useState('')
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setForms(await getTallyForms())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load forms')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openDialog = () => {
    setNewFormId('')
    setNewTitle('')
    setNewSecret('')
    setDialogOpen(true)
  }

  const create = async () => {
    if (!newFormId.trim() || !newTitle.trim() || !newSecret.trim()) return
    setCreating(true)
    try {
      const created = await registerTallyForm(newFormId.trim(), {
        title: newTitle.trim(),
        signing_secret: newSecret.trim(),
      })
      setForms((prev) => [...prev, { ...created, submission_count: 0 }])
      setDialogOpen(false)
      toast.success(t('staff.forms.createSuccess'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to register form')
    } finally {
      setCreating(false)
    }
  }

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
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">{t('staff.tabs.forms')}</p>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <PlusIcon className="size-4 mr-1.5" />
          {t('staff.forms.createForm')}
        </Button>
      </div>

      {forms.length === 0 ? (
        <div className="flex flex-col items-center gap-5 py-16 text-center">
          <div className="rounded-full border bg-muted/40 p-5">
            <PlusIcon className="size-7 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{t('staff.forms.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">{t('staff.forms.emptyDescription')}</p>
          </div>
          <Button size="sm" onClick={openDialog}>
            <PlusIcon className="size-4 mr-1.5" />
            {t('staff.forms.createForm')}
          </Button>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('staff.forms.formTitle')}</TableHead>
                <TableHead>{t('staff.forms.formId')}</TableHead>
                <TableHead>{t('staff.forms.createdAt')}</TableHead>
                <TableHead>{t('staff.forms.submissions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map((form) => (
                <TableRow key={form.form_id} className="cursor-pointer" onClick={() => onSelect(form)}>
                  <TableCell className="font-medium">{form.title}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{form.form_id}</TableCell>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">
                    {new Date(form.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="tabular-nums">{form.submission_count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('staff.forms.createDialog.title')}</DialogTitle>
            <DialogDescription>{t('staff.forms.createDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1">
            <Field>
              <FieldTitle>{t('staff.forms.createDialog.formId')}</FieldTitle>
              <Input
                value={newFormId}
                onChange={(e) => setNewFormId(e.target.value)}
                placeholder="mYfOrM"
                className="font-mono mt-2"
              />
              <FieldDescription>{t('staff.forms.createDialog.formIdDescription')}</FieldDescription>
            </Field>
            <Field>
              <FieldTitle>{t('staff.forms.createDialog.formTitle')}</FieldTitle>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Candidature modérateur"
                className="mt-2"
                onKeyDown={(e) => e.key === 'Enter' && create()}
              />
            </Field>
            <Field>
              <FieldTitle>{t('staff.forms.createDialog.signingSecret')}</FieldTitle>
              <Input
                value={newSecret}
                onChange={(e) => setNewSecret(e.target.value)}
                placeholder="tally_secret_..."
                type="password"
                className="font-mono mt-2"
              />
              <FieldDescription>{t('staff.forms.createDialog.signingSecretDescription')}</FieldDescription>
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>
              {t('staff.forms.createDialog.cancel')}
            </Button>
            <Button
              onClick={create}
              disabled={creating || !newFormId.trim() || !newTitle.trim() || !newSecret.trim()}
            >
              {creating && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
              {t('staff.forms.createDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

const SUBMISSIONS_LIMIT = 50

function FormSubmissions({
  formId,
  formTitle,
  onSelect,
  onBack,
}: {
  formId: string
  formTitle: string
  onSelect: (submissionId: string) => void
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [data, setData] = useState<TallySubmissionsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    setError(null)
    try {
      setData(await getTallySubmissions(formId, SUBMISSIONS_LIMIT, p * SUBMISSIONS_LIMIT))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions')
    } finally {
      setLoading(false)
    }
  }, [formId])

  useEffect(() => { load(page) }, [load, page])

  const totalPages = data ? Math.ceil(data.total / SUBMISSIONS_LIMIT) : 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeftIcon className="size-4 mr-1" />
          {t('staff.forms.backToForms')}
        </Button>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-medium truncate">{formTitle}</span>
      </div>

      {loading && <Skeleton className="h-48 rounded-xl" />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <XCircleIcon className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={() => load(page)}>
            <RefreshCwIcon className="size-4 mr-1.5" />
            {t('guildOverview.refresh')}
          </Button>
        </div>
      )}

      {data && !loading && (
        <>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('staff.forms.submissionId')}</TableHead>
                  <TableHead>{t('staff.forms.discordId')}</TableHead>
                  <TableHead>{t('staff.forms.date')}</TableHead>
                  <TableHead>{t('staff.forms.status')}</TableHead>
                  <TableHead>{t('staff.forms.note')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      {t('staff.forms.noSubmissions')}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((item) => (
                    <TableRow
                      key={item.submission_id}
                      className="cursor-pointer"
                      onClick={() => onSelect(item.submission_id)}
                    >
                      <TableCell className="font-mono text-xs">{item.submission_id}</TableCell>
                      <TableCell className="font-mono text-xs">{item.discord_id}</TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {new Date(item.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell><StatusBadge status={item.status} /></TableCell>
                      <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                        {item.note ?? <span className="opacity-50">—</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>{t('staff.forms.pagination', { current: page + 1, total: totalPages, count: data.total })}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeftIcon className="size-4" />
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRightIcon className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SubmissionDetail({
  submissionId,
  formTitle,
  onBack,
}: {
  submissionId: string
  formTitle: string
  onBack: () => void
}) {
  const { t } = useTranslation()
  const [detail, setDetail] = useState<TallySubmissionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionStatus, setActionStatus] = useState<TallySubmissionStatus>('pending')
  const [actionNote, setActionNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const d = await getTallySubmission(submissionId)
      setDetail(d)
      setActionStatus(d.status)
      setActionNote(d.note ?? '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submission')
    } finally {
      setLoading(false)
    }
  }, [submissionId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    setSaving(true)
    try {
      const updated = await updateTallySubmission(submissionId, {
        status: actionStatus,
        note: actionNote,
      })
      setDetail((prev) => prev ? { ...prev, status: updated.status, note: updated.note } : prev)
      toast.success(t('staff.forms.saved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const visibleAnswers = detail?.answers.filter(
    (a) => !HIDDEN_FIELD_LABELS.includes(a.label.toLowerCase())
  ) ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ChevronLeftIcon className="size-4 mr-1" />
          {formTitle}
        </Button>
        <span className="text-sm text-muted-foreground">/</span>
        <span className="text-sm font-mono text-muted-foreground truncate">{submissionId}</span>
      </div>

      {loading && <Skeleton className="h-64 rounded-xl" />}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <XCircleIcon className="size-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCwIcon className="size-4 mr-1.5" />
            {t('guildOverview.refresh')}
          </Button>
        </div>
      )}

      {detail && !loading && (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">{t('staff.forms.generalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('staff.forms.discordId')}</p>
                <p className="font-mono text-sm mt-0.5">{detail.discord_id}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('staff.forms.date')}</p>
                <p className="text-sm mt-0.5">{new Date(detail.created_at).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{t('staff.forms.status')}</p>
                <div className="mt-1"><StatusBadge status={detail.status} /></div>
              </div>
            </CardContent>
          </Card>

          {visibleAnswers.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">{t('staff.forms.answers')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y">
                {visibleAnswers.map((answer) => (
                  <div key={answer.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="text-xs font-medium text-muted-foreground mb-1">{answer.label}</p>
                    <p className="text-sm whitespace-pre-wrap">{answer.value || '—'}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">{t('staff.forms.action')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {/* Segmented control statut */}
              <Field>
                <FieldTitle>{t('staff.forms.status')}</FieldTitle>
                <div className="inline-flex rounded-xl border bg-muted/40 p-1 gap-0.5 w-fit mt-2">
                  {(['pending', 'done', 'rejected'] as TallySubmissionStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setActionStatus(s)}
                      className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-lg transition-all select-none cursor-pointer",
                        actionStatus === s
                          ? s === 'done'
                            ? "bg-green-600 text-white shadow-sm"
                            : s === 'rejected'
                            ? "bg-destructive text-destructive-foreground shadow-sm"
                            : "bg-amber-500 text-white shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                      )}
                    >
                      {t(`staff.forms.statusLabel.${s}`)}
                    </button>
                  ))}
                </div>
              </Field>

              <Separator />

              {/* Note */}
              <Field>
                <FieldTitle>{t('staff.forms.note')}</FieldTitle>
                <Textarea
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={t('staff.forms.notePlaceholder')}
                  className="resize-none mt-2"
                  rows={4}
                />
                <FieldDescription>{t('staff.forms.noteDescription')}</FieldDescription>
              </Field>

              <div className="flex justify-end">
                <Button onClick={save} disabled={saving} size="sm">
                  {saving && <LoaderIcon className="size-4 animate-spin mr-1.5" />}
                  {t('staff.forms.save')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function FormsTab() {
  const [view, setView] = useState<FormsView>({ type: 'list' })

  if (view.type === 'submissions') return (
    <FormSubmissions
      formId={view.formId}
      formTitle={view.formTitle}
      onSelect={(id) => setView({ type: 'detail', submissionId: id, formId: view.formId, formTitle: view.formTitle })}
      onBack={() => setView({ type: 'list' })}
    />
  )

  if (view.type === 'detail') return (
    <SubmissionDetail
      submissionId={view.submissionId}
      formTitle={view.formTitle}
      onBack={() => setView({ type: 'submissions', formId: view.formId, formTitle: view.formTitle })}
    />
  )

  return <FormsList onSelect={(form) => setView({ type: 'submissions', formId: form.form_id, formTitle: form.title })} />
}

// ─── Page principale ──────────────────────────────────────────────────────────

export function StaffPage() {
  const { t } = useTranslation()
  const { user } = useGuildContext()
  const [searchParams] = useSearchParams()

  const activeTab = searchParams.get('tab') ?? 'stats'

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
      {/* Contenu de l'onglet actif — navigation gérée par la sidebar */}
      {activeTab === 'stats' && hasRole(staffRoles, CAN_ACCESS_STATS) && (
        <StatsTab staffRoles={staffRoles} />
      )}
      {activeTab === 'users' && hasRole(staffRoles, CAN_MANAGE_USERS) && (
        <UsersTab />
      )}
      {activeTab === 'guilds' && hasRole(staffRoles, CAN_MANAGE_GUILDS) && (
        <GuildsTab />
      )}
      {activeTab === 'cases' && hasRole(staffRoles, CAN_VIEW_CASES) && (
        <CasesTab />
      )}
      {activeTab === 'forms' && hasRole(staffRoles, CAN_ACCESS_FORMS) && (
        <FormsTab />
      )}
    </div>
  )
}
