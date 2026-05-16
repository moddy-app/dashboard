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

        <Tabs defaultValue="account">
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
          <TabsContent value="account" className="mt-4 flex flex-col gap-4">
            {user && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="size-14 rounded-xl">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="rounded-xl text-lg font-bold">
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
                    {/* Badge abonnement Moddy Premium */}
                    {user.is_staff && (
                      <Badge variant="secondary" className="text-xs shrink-0 bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-800">
                        Staff
                      </Badge>
                    )}
                  </div>
                  {user.email && (
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  )}
                  {user.locale && (
                    <p className="text-xs text-muted-foreground/60">
                      {user.locale} {user.verified && '· Email vérifié'}
                    </p>
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
                  <svg viewBox="0 0 24 24" className="size-5 fill-white">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.1.12 18.14.143 18.163a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Discord</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">
                    {user?.user_id}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="size-2 rounded-full bg-green-500" />
                  <span className="text-xs text-muted-foreground">{t('settings.account.connected')}</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── Apparence ──────────────────────────────────────────────── */}
          <TabsContent value="appearance" className="mt-4 flex flex-col gap-4">
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
          <TabsContent value="billing" className="mt-4 flex flex-col gap-4">
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
