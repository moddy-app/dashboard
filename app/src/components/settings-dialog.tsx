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
import {
  SunIcon,
  MoonIcon,
  MonitorIcon,
  GlobeIcon,
  CreditCardIcon,
  UserIcon,
  SparklesIcon,
} from "lucide-react"
import { useTheme } from "@/components/theme-provider"
import { getPreferences, setPreferences, detectBrowserLanguage } from "@/lib/preferences"
import { getAvatarUrl, getDisplayName } from "@/lib/auth"
import { openBillingPortal } from "@/services/guilds"
import { toast } from "sonner"
import type { User } from "@/lib/auth"

interface SettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: User | null
}

export function SettingsDialog({ open, onOpenChange, user }: SettingsDialogProps) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()

  const prefs = getPreferences()
  const currentLang = prefs.language ?? detectBrowserLanguage(['en', 'fr'], 'en')

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

  const avatarUrl = user
    ? getAvatarUrl(user.user_id, user.avatar, user.avatar_url)
    : ''

  const displayName = user ? getDisplayName(user) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="account" className="gap-6">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex-1">
              <UserIcon className="size-4 mr-1.5" />
              {t('settings.tabs.account')}
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1">
              <MonitorIcon className="size-4 mr-1.5" />
              {t('settings.tabs.appearance')}
            </TabsTrigger>
            <TabsTrigger value="billing" className="flex-1">
              <CreditCardIcon className="size-4 mr-1.5" />
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

            {/* Connexion Discord */}
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
            {/* Thème */}
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

            {/* Langue */}
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
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
