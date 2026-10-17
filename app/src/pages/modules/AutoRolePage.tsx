import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { UnsavedBar } from "@/components/unsaved-bar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { AlertCircleIcon } from "@/components/icons"
import { ModulePage } from "@/components/module/module-page"
import { ModuleStateControl } from "@/components/module/module-state-control"
import { RoleMultiPicker } from "@/components/pickers"
import { useGuildContext } from "@/contexts/GuildContext"
import { ApiError } from "@/lib/auth"
import { botTopRolePosition, isRoleAboveBot } from "@/lib/altguard"
import { handleSaveError } from "@/lib/handle-error"
import { logger } from "@/lib/logger"
import type { AutoRoleConfig, Role } from "@/types/api"

const MODULE_ID = "auto_role"
const MAX_ROLES = 20
const KNOWN_ERRORS = [
  "auto_role_role_not_found",
  "auto_role_everyone",
  "auto_role_managed",
  "auto_role_too_high",
] as const

/** Ancien format `role_ids` lu comme `member_roles`. */
function readLists(config: AutoRoleConfig | undefined): { member: string[]; bot: string[] } {
  const strings = (v: unknown) => (Array.isArray(v) ? v.map(String) : [])
  const member = strings(config?.member_roles)
  return {
    member: member.length > 0 ? member : strings(config?.role_ids),
    bot: strings(config?.bot_roles),
  }
}

interface SaveProblem {
  /** Clé i18n (code connu) ou message brut du backend. */
  code: string | null
  message: string
  roleIds: string[]
}

function toProblem(e: unknown): SaveProblem | null {
  if (!(e instanceof ApiError) || e.status !== 422) return null
  const body = e.body ?? {}
  const raw = String(body.code ?? body.error ?? "")
  const code = (KNOWN_ERRORS as readonly string[]).includes(raw) ? raw : null
  const roleIds = Array.isArray(body.role_ids) ? body.role_ids.map(String) : []
  return { code, message: e.message, roleIds }
}

export function AutoRolePage() {
  const { t } = useTranslation()
  const { roles, modules, updateModule, disableModule, isLoadingGuild, isGuildReady, guildError, refreshGuildData } =
    useGuildContext()

  const config = modules[MODULE_ID] as AutoRoleConfig | undefined
  const saved = useMemo(() => readLists(config), [config])

  const [member, setMember] = useState<string[]>(saved.member)
  const [bot, setBot] = useState<string[]>(saved.bot)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState<SaveProblem | null>(null)

  useEffect(() => {
    setMember(saved.member)
    setBot(saved.bot)
  }, [saved])

  const botTop = useMemo(() => botTopRolePosition(roles), [roles])
  const disabledReason = (role: Role) => (isRoleAboveBot(role, botTop) ? t("modules.auto_role.aboveBot") : null)

  const same = (a: string[], b: string[]) => [...a].sort().join(",") === [...b].sort().join(",")
  const isDirty = !same(member, saved.member) || !same(bot, saved.bot)
  const isEmpty = member.length === 0 && bot.length === 0
  const isConfigured = saved.member.length > 0 || saved.bot.length > 0

  const handleSave = async () => {
    setSaving(true)
    setProblem(null)
    try {
      if (isEmpty) {
        await disableModule(MODULE_ID)
        toast.success(t("modules.auto_role.disabledSuccess"))
        return
      }
      await updateModule(MODULE_ID, { member_roles: member, bot_roles: bot })
      toast.success(t("modules.saved"))
    } catch (e) {
      logger.error(`module:${MODULE_ID}`, "Save failed", e)
      const p = toProblem(e)
      if (p) setProblem(p)
      else handleSaveError(e, { title: t("modules.saveError") })
    } finally {
      setSaving(false)
    }
  }

  const faultyNames = (problem?.roleIds ?? []).map((id) => roles.find((r) => r.id === id)?.name ?? id)

  const section = (
    key: "member" | "bot",
    value: string[],
    onChange: (v: string[]) => void
  ) => (
    <Card>
      <CardHeader>
        <CardTitle>{t(`modules.auto_role.${key}Title`)}</CardTitle>
        <CardDescription>{t(`modules.auto_role.${key}Description`)}</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>{t("modules.auto_role.rolesLabel")}</FieldLabel>
            <RoleMultiPicker
              value={value}
              onChange={onChange}
              max={MAX_ROLES}
              disabledReason={disabledReason}
              placeholder={t("modules.auto_role.addRole")}
            />
            <FieldDescription>{t("modules.auto_role.max", { max: MAX_ROLES })}</FieldDescription>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  )

  return (
    <ModulePage
      moduleId={MODULE_ID}
      loading={isLoadingGuild || !isGuildReady}
      error={guildError}
      onRetry={refreshGuildData}
      actions={<ModuleStateControl moduleId={MODULE_ID} />}
    >
      {problem && (
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{t("modules.saveError")}</AlertTitle>
          <AlertDescription>
            {problem.code ? t(`modules.auto_role.errors.${problem.code}`) : problem.message}
            {faultyNames.length > 0 && ` ${faultyNames.join(", ")}`}
          </AlertDescription>
        </Alert>
      )}
      {isDirty && isEmpty && isConfigured && (
        <Alert>
          <AlertCircleIcon />
          <AlertDescription>{t("modules.auto_role.emptyHint")}</AlertDescription>
        </Alert>
      )}
      {section("member", member, setMember)}
      {section("bot", bot, setBot)}
      <UnsavedBar
        isDirty={isDirty}
        isSaving={saving}
        onSave={handleSave}
        onDiscard={() => {
          setMember(saved.member)
          setBot(saved.bot)
          setProblem(null)
        }}
      />
    </ModulePage>
  )
}
