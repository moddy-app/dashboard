import { useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Trash2Icon,
  UsersIcon,
  XIcon,
  PlusIcon,
  LoaderIcon,
} from "lucide-react"
import { UnsavedBar } from "@/components/unsaved-bar"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { ErrorPage } from "@/components/error-state"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useGuildContext } from "@/contexts/GuildContext"
import { roleColorToHex } from "@/types/api"
import type { AutoRoleConfig } from "@/types/api"

export function AutoRolePage() {
  const { t } = useTranslation()
  const {
    selectedGuildId,
    roles,
    modules,
    isLoadingGuild,
    guildError,
    refreshGuildData,
    updateModule,
    disableModule,
  } = useGuildContext()

  const currentConfig = modules['auto_role'] as AutoRoleConfig | undefined
  const isEnabled = 'auto_role' in modules

  const [enabled, setEnabled] = useState(isEnabled)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(
    currentConfig?.role_ids.map(String) ?? []
  )
  const [saving, setSaving] = useState(false)

  // Valeurs enregistrées — pour calculer isDirty
  const [savedEnabled, setSavedEnabled] = useState(isEnabled)
  const [savedRoleIds, setSavedRoleIds] = useState<string[]>(
    currentConfig?.role_ids.map(String) ?? []
  )

  // Exclure les rôles gérés par des intégrations (bots)
  const manageableRoles = roles.filter(
    (r) => !r.managed && r.name !== '@everyone'
  )

  // Re-populate quand config ou liste de rôles chargée
  useEffect(() => {
    const ids = currentConfig?.role_ids.map(String) ?? []
    setSelectedRoleIds(ids)
    setSavedRoleIds(ids)
    setEnabled(isEnabled)
    setSavedEnabled(isEnabled)
  }, [currentConfig, isEnabled, roles.length])

  // Calcul du dirty state
  const isDirty = useMemo(() => {
    if (enabled !== savedEnabled) return true
    const a = [...selectedRoleIds].sort().join(',')
    const b = [...savedRoleIds].sort().join(',')
    return a !== b
  }, [enabled, savedEnabled, selectedRoleIds, savedRoleIds])

  const addRole = (roleId: string) => {
    if (!selectedRoleIds.includes(roleId)) {
      setSelectedRoleIds((prev) => [...prev, roleId])
    }
  }

  const removeRole = (roleId: string) => {
    setSelectedRoleIds((prev) => prev.filter((id) => id !== roleId))
  }

  const handleSave = async () => {
    if (!selectedGuildId) return
    logger.event('module:auto_role', 'Submit', { enabled, roleIds: selectedRoleIds })
    setSaving(true)
    try {
      if (!enabled) {
        await disableModule('auto_role')
        setSavedEnabled(false)
        setSavedRoleIds([])
        toast.success(t('modules.auto_role.disabledSuccess'))
        return
      }
      await updateModule('auto_role', {
        role_ids: selectedRoleIds,
      })
      setSavedEnabled(enabled)
      setSavedRoleIds([...selectedRoleIds])
      logger.success('module:auto_role', 'Saved')
      toast.success(t('modules.saved'))
    } catch (e) {
      logger.error('module:auto_role', 'Save failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    logger.event('module:auto_role', 'Discard clicked')
    setEnabled(savedEnabled)
    setSelectedRoleIds([...savedRoleIds])
  }

  const handleDisable = async () => {
    logger.event('module:auto_role', 'Disable clicked')
    setSaving(true)
    try {
      await disableModule('auto_role')
      setEnabled(false)
      setSavedEnabled(false)
      setSavedRoleIds([])
      setSelectedRoleIds([])
      logger.success('module:auto_role', 'Disabled')
      toast.success(t('modules.auto_role.disabledSuccess'))
    } catch (e) {
      logger.error('module:auto_role', 'Disable failed', e)
      handleSaveError(e, { title: t('modules.saveError') })
    } finally {
      setSaving(false)
    }
  }

  if (isLoadingGuild) {
    return (
      <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (guildError) {
    return <ErrorPage error={guildError} onRetry={refreshGuildData} />
  }

  const availableRoles = manageableRoles.filter(
    (r) => !selectedRoleIds.includes(r.id)
  )

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto pb-24">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-green-100 dark:bg-green-950 flex items-center justify-center">
            <UsersIcon className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t('modules.auto_role.name')}</h1>
            <p className="text-sm text-muted-foreground">{t('modules.auto_role.description')}</p>
          </div>
        </div>
        <Badge variant={isEnabled ? "default" : "secondary"}>
          {isEnabled ? t('guildOverview.modules.enabled') : t('guildOverview.modules.disabled')}
        </Badge>
      </div>

      <Separator />

      {/* Toggle */}
      <Card>
        <CardContent className="flex items-center justify-between gap-6 px-5 py-4">
          <div className="flex flex-col gap-1 min-w-0">
            <p className="font-medium text-sm leading-none">{t('modules.enableModule')}</p>
            <p className="text-sm text-muted-foreground leading-snug">
              {t('modules.auto_role.enableDescription')}
            </p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} className="shrink-0" />
        </CardContent>
      </Card>

      {/* Config rôles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('modules.auto_role.configTitle')}</CardTitle>
          <CardDescription>{t('modules.auto_role.configDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Rôles sélectionnés */}
          {selectedRoleIds.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedRoleIds.map((id) => {
                const role = roles.find((r) => r.id === id)
                if (!role) return null
                const color = roleColorToHex(role.color)
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium border"
                    style={{ borderColor: color, color }}
                  >
                    {role.name}
                    <button
                      type="button"
                      onClick={() => removeRole(id)}
                      className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </span>
                )
              })}
            </div>
          )}

          {/* Sélecteur de rôle */}
          {availableRoles.length > 0 && (
            <div className="flex items-center gap-2">
              <Select onValueChange={addRole}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t('modules.auto_role.addRole')} />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => {
                    const color = roleColorToHex(role.color)
                    return (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          {role.name}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedRoleIds.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground rounded-lg border border-dashed p-4">
              <PlusIcon className="size-4" />
              {t('modules.auto_role.noRoles')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bouton désactiver (uniquement si déjà activé) */}
      {isEnabled && (
        <Button
          type="button"
          variant="outline"
          className="text-destructive hover:text-destructive w-fit"
          onClick={handleDisable}
          disabled={saving}
        >
          {saving ? (
            <LoaderIcon className="size-4 mr-2 animate-spin" />
          ) : (
            <Trash2Icon className="size-4 mr-2" />
          )}
          {t('modules.disable')}
        </Button>
      )}

      {/* Save bar Discord-style */}
      <UnsavedBar
        isDirty={isDirty}
        isSaving={saving}
        onSave={handleSave}
        onDiscard={handleDiscard}
      />
    </div>
  )
}
