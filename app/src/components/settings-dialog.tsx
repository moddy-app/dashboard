"use client"

import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  GlobeIcon,
  CreditCardIcon,
  UserIcon,
  SparklesIcon,
  XIcon,
  PlusIcon,
  LoaderIcon,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { getPreferences, setPreferences, detectBrowserLanguage } from "@/lib/preferences"
import { getAvatarUrl, getDisplayName, getGuildIconUrl, ApiError } from "@/lib/auth"
import {
  openBillingPortal,
  getSubscriptionStatus,
  addSubscriptionServer,
  removeSubscriptionServer,
} from "@/services/guilds"
import { invalidatePremiumGuilds } from "@/hooks/usePremiumGuilds"
import { toast } from "sonner"
import type { User } from "@/lib/auth"
import type { SubscriptionData } from "@/types/api"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
  defaultTab?: string
}

export function SettingsDialog({ open, onOpenChange, user, defaultTab }: SettingsDialogProps) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  const prefs = getPreferences()
  const currentLang = prefs.language ?? detectBrowserLanguage(['en', 'fr'], 'en')

  const [activeTab, setActiveTab] = useState('account')
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [subscriptionLoading, setSubscriptionLoading] = useState(false)
  const [selectedServerId, setSelectedServerId] = useState('')
  const [addingServer, setAddingServer] = useState(false)
  const [removingServerId, setRemovingServerId] = useState<string | null>(null)

  // Reset state when dialog closes / set tab when it opens
  useEffect(() => {
    if (!open) {
      setSubscription(null)
      setSelectedServerId('')
      setActiveTab('account')
    } else if (defaultTab) {
      setActiveTab(defaultTab)
    }
  }, [open, defaultTab])

  // Fetch subscription when billing tab is opened
  useEffect(() => {
    if (activeTab !== 'billing' || !open) return
    setSubscriptionLoading(true)
    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setSubscriptionLoading(false))
  }, [activeTab, open])

  const handleLangChange = (lang: string | 'auto') => {
    if (lang === 'auto') {
      setPreferences({ language: undefined as unknown as string })
      const detected = detectBrowserLanguage(['en', 'fr'], 'en')
      i18n.changeLanguage(detected)
    } else {
      setPreferences({ language: lang })
      i18n.changeLanguage(lang)
    }
  }

  const handleOpenBilling = async () => {
    try {
      const url = await openBillingPortal()
      window.location.href = url
    } catch {
      toast.error(t('settings.billing.portalError'))
    }
  }

  const handleAddServer = useCallback(async () => {
    if (!selectedServerId) return
    setAddingServer(true)
    try {
      const added = await addSubscriptionServer(selectedServerId)
      setSubscription(prev =>
        prev ? { ...prev, servers: [...prev.servers, added] } : prev
      )
      invalidatePremiumGuilds()
      setSelectedServerId('')
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(t('settings.billing.servers.alreadyLinked'))
      } else if (e instanceof ApiError && e.isForbidden) {
        toast.error(t('settings.billing.servers.addForbidden'))
      } else {
        toast.error(t('settings.billing.servers.addError'))
      }
    } finally {
      setAddingServer(false)
    }
  }, [selectedServerId, t])

  const handleRemoveServer = useCallback(async (serverId: string) => {
    setRemovingServerId(serverId)
    try {
      await removeSubscriptionServer(serverId)
      setSubscription(prev =>
        prev
          ? { ...prev, servers: prev.servers.filter(s => s.server_id !== serverId) }
          : prev
      )
      invalidatePremiumGuilds()
    } catch {
      toast.error(t('settings.billing.servers.removeError'))
    } finally {
      setRemovingServerId(null)
    }
  }, [t])

  const avatarUrl = user
    ? getAvatarUrl(user.user_id, user.avatar, user.avatar_url)
    : ''

  const displayName = user ? getDisplayName(user) : ''

  const availableGuilds = user?.guilds.filter(
    g => !subscription?.servers.some(s => s.server_id === String(g.id))
  ) ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-col gap-4">
          <TabsList className="w-full">
            <TabsTrigger value="account">
              <UserIcon />
              {t('settings.tabs.account')}
            </TabsTrigger>
            <TabsTrigger value="appearance">
              <MonitorIcon />
              {t('settings.tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger value="billing">
              <CreditCardIcon />
              {t('settings.tabs.billing')}
            </TabsTrigger>
          </TabsList>

          {/* ── Compte ─────────────────────────────────────────────────── */}
          <TabsContent value="account" className="flex flex-col gap-4">
            {user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="size-14 rounded-full">
                  <AvatarImage src={avatarUrl} alt={displayName} className="rounded-full" />
                  <AvatarFallback className="rounded-full text-lg font-bold">
                    {displayName?.slice(0, 2)?.toUpperCase() ?? '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">
                      {displayName}
                      {user.global_name && user.global_name !== user.username && (
                        <span className="text-muted-foreground font-normal text-sm ml-1.5">
                          @{user.username}
                        </span>
                      )}
                    </p>
                    {user.is_staff && (
                      <Badge variant="outline" className="text-xs shrink-0 text-violet-600 border-violet-300 dark:text-violet-400 dark:border-violet-700">
                        Staff
                      </Badge>
                    )}
                  </div>
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                </div>
              </div>
            )}

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">{t('settings.account.connectedWith')}</Label>
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="size-8 rounded-lg bg-[#5865F2] flex items-center justify-center shrink-0">
                  <svg width="20" height="20" viewBox="0 0 71 55" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M60.105 4.898A58.55 58.55 0 0 0 45.653.415a.22.22 0 0 0-.233.11 40.784 40.784 0 0 0-1.8 3.697 54.074 54.074 0 0 0-16.232 0A41.835 41.835 0 0 0 25.57.525a.228.228 0 0 0-.233-.11A58.408 58.408 0 0 0 10.886 4.9a.207.207 0 0 0-.095.082C1.578 18.73-.944 32.144.293 45.388a.244.244 0 0 0 .093.167c6.073 4.46 11.956 7.167 17.729 8.962a.23.23 0 0 0 .249-.082 42.08 42.08 0 0 0 3.627-5.9.225.225 0 0 0-.123-.312 38.772 38.772 0 0 1-5.539-2.64.228.228 0 0 1-.022-.378 31.772 31.772 0 0 0 1.1-.862.22.22 0 0 1 .23-.03c11.619 5.304 24.198 5.304 35.68 0a.219.219 0 0 1 .232.027c.356.293.724.586 1.102.865a.228.228 0 0 1-.02.378 36.384 36.384 0 0 1-5.54 2.638.226.226 0 0 0-.12.314 47.249 47.249 0 0 0 3.623 5.897.225.225 0 0 0 .249.084c5.801-1.795 11.684-4.502 17.757-8.962a.228.228 0 0 0 .093-.164c1.48-15.315-2.48-28.618-10.498-40.408a.18.18 0 0 0-.093-.084ZM23.725 37.322c-3.497 0-6.38-3.211-6.38-7.156s2.828-7.156 6.38-7.156c3.58 0 6.435 3.24 6.38 7.156 0 3.945-2.827 7.156-6.38 7.156Zm23.598 0c-3.497 0-6.38-3.211-6.38-7.156s2.827-7.156 6.38-7.156c3.58 0 6.435 3.24 6.38 7.156 0 3.945-2.8 7.156-6.38 7.156Z" fill="white"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Discord</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {user?.user_id}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="size-2 rounded-full bg-green-500 shrink-0" />
                  <span className="text-xs text-muted-foreground">{t('settings.account.connected')}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Apparence ──────────────────────────────────────────────── */}
          <TabsContent value="appearance" className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">{t('debug.themeSwitcher')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'light', icon: SunIcon, label: t('debug.themeLight') },
                  { value: 'dark', icon: MoonIcon, label: t('debug.themeDark') },
                  { value: 'system', icon: MonitorIcon, label: t('debug.themeAuto') },
                ].map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
                      theme === value
                        ? 'border-primary bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    <Icon className="size-5" />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">
                <GlobeIcon className="size-4 inline mr-1.5" />
                {t('debug.languageSwitcher')}
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'auto', label: t('debug.languageAuto') },
                  { value: 'en', label: 'English' },
                  { value: 'fr', label: 'Français' },
                ].map(({ value, label }) => {
                  const isActive =
                    value === 'auto' ? !prefs.language : currentLang === value
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => handleLangChange(value)}
                      className={`rounded-lg border p-3 text-sm transition-colors cursor-pointer ${
                        isActive
                          ? 'border-primary bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>
          </TabsContent>

          {/* ── Facturation ────────────────────────────────────────────── */}
          <TabsContent value="billing" className="flex flex-col gap-4">
            {subscriptionLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ) : subscription?.is_active ? (
              <>
                {/* Statut abonnement */}
                <div className="rounded-lg border p-4 flex items-center gap-3">
                  <SparklesIcon className="size-8 text-amber-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{t('settings.billing.activeTitle')}</p>
                    {subscription.expires_at && (
                      <p className="text-xs text-muted-foreground">
                        {t('settings.billing.renewsAt', {
                          date: new Date(subscription.expires_at).toLocaleDateString(),
                        })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {t(`settings.billing.tier.${subscription.tier ?? 'free_trial'}`)}
                  </Badge>
                </div>

                {/* Gestion des serveurs liés */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">
                      {t('settings.billing.servers.title')}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {t('settings.billing.servers.usage', {
                        count: subscription.servers.length,
                        max: subscription.max_servers,
                      })}
                    </span>
                  </div>

                  {subscription.servers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4 rounded-lg border border-dashed">
                      {t('settings.billing.servers.empty')}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-1.5">
                      {subscription.servers.map(({ server_id }) => {
                        const guild = user?.guilds.find(g => String(g.id) === server_id)
                        const iconUrl = guild ? getGuildIconUrl(guild.id, guild.icon) : null
                        const name = guild?.name ?? server_id
                        return (
                          <div
                            key={server_id}
                            className="flex items-center gap-3 p-2.5 rounded-lg border"
                          >
                            <Avatar className="size-8 rounded-lg shrink-0">
                              <AvatarImage
                                src={iconUrl ?? undefined}
                                alt={name}
                                referrerPolicy="no-referrer"
                                className="rounded-lg"
                              />
                              <AvatarFallback className="rounded-lg text-xs font-semibold">
                                {name.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-sm font-medium truncate">{name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive shrink-0"
                              onClick={() => handleRemoveServer(server_id)}
                              disabled={removingServerId === server_id}
                            >
                              {removingServerId === server_id ? (
                                <LoaderIcon className="size-3.5 animate-spin" />
                              ) : (
                                <XIcon className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {subscription.servers.length < subscription.max_servers && (
                    <div className="flex gap-2 mt-1">
                      <Select value={selectedServerId} onValueChange={setSelectedServerId}>
                        <SelectTrigger className="flex-1 w-0">
                          <SelectValue placeholder={t('settings.billing.servers.addPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {availableGuilds.length === 0 ? (
                            <div className="px-2 py-3 text-sm text-muted-foreground text-center">
                              {t('settings.billing.servers.noAvailable')}
                            </div>
                          ) : (
                            availableGuilds.map(guild => {
                              const iconUrl = getGuildIconUrl(guild.id, guild.icon)
                              return (
                                <SelectItem key={guild.id} value={String(guild.id)}>
                                  <div className="flex items-center gap-2">
                                    <Avatar className="size-5 rounded shrink-0">
                                      <AvatarImage
                                        src={iconUrl ?? undefined}
                                        alt={guild.name}
                                        referrerPolicy="no-referrer"
                                      />
                                      <AvatarFallback className="text-[8px] rounded">
                                        {guild.name.slice(0, 1).toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    {guild.name}
                                  </div>
                                </SelectItem>
                              )
                            })
                          )}
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleAddServer}
                        disabled={!selectedServerId || addingServer}
                        className="shrink-0"
                      >
                        {addingServer ? (
                          <LoaderIcon className="size-4 animate-spin" />
                        ) : (
                          <PlusIcon className="size-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <Button onClick={handleOpenBilling} variant="outline" className="w-full">
                  <CreditCardIcon className="size-4 mr-2" />
                  {t('settings.billing.manageButton')}
                </Button>
              </>
            ) : (
              <>
                <div className="rounded-lg border p-4 flex items-center gap-3">
                  <SparklesIcon className="size-8 text-amber-500 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">{t('settings.billing.title')}</p>
                    <p className="text-xs text-muted-foreground">{t('settings.billing.description')}</p>
                  </div>
                </div>
                <Button onClick={handleOpenBilling} className="w-full" variant="outline">
                  <CreditCardIcon className="size-4 mr-2" />
                  {t('settings.billing.manageButton')}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  {t('settings.billing.note')}
                </p>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
