import type { IconComponent } from '@/components/icons'
import {
  BellRingIcon,
  FingerprintIcon,
  ReceiptLongIcon,
  GaugeIcon,
  MailIcon,
  MessageSquareIcon,
  PaletteIcon,
  RocketIcon,
  SparklesIcon,
  StarIcon,
  TicketIcon,
  UserPlusIcon,
  UsersIcon,
} from '@/components/icons'
import type { ModuleState } from '@/types/api'
import { isWelcomeActive } from '@/lib/welcome'
import { isWelcomeDmActive } from '@/lib/welcome-dm'
import { isBotCustomizationActive } from '@/lib/bot-customization'
import { isAltGuardActive } from '@/lib/altguard'
import { isLogsActive } from '@/lib/logs'
import { isTicketsActive } from '@/lib/tickets'
import { isMemberApplicationsActive } from '@/lib/member-applications'
import { isBumpReminderActive } from '@/lib/bump-reminder'

// Registre des modules du dashboard : source unique pour la sidebar, la vue
// d'ensemble et l'en-tête de chaque page de module.

const MODULE_STATES: readonly ModuleState[] = ['active', 'paused', 'simulation']

/** État d'un module : valeur inconnue ou absente = `active` (comme le backend). */
export function readModuleState(raw: unknown): ModuleState {
  return typeof raw === 'string' && (MODULE_STATES as readonly string[]).includes(raw)
    ? (raw as ModuleState)
    : 'active'
}

export type ModuleGroupId = 'moderation' | 'welcome' | 'engagement' | 'customization'

export type ModuleStatus = 'not_configured' | 'active' | 'paused' | 'simulation' | 'incomplete'

export interface ModuleDefinition {
  id: string
  group: ModuleGroupId
  path: (guildId: string) => string
  icon: IconComponent
  titleKey: string
  descriptionKey: string
  /** Peut être mis en pause (`state: 'paused'`). */
  supportsPause: boolean
  /** Gère `state: 'simulation'` (Automod uniquement). */
  supportsSimulation: boolean
  /** Le module tourne-t-il réellement avec cette config (hors `state`) ? */
  isActive: (config: unknown) => boolean
}

type Rec = Record<string, unknown>

function asRec(config: unknown): Rec {
  return config !== null && typeof config === 'object' ? (config as Rec) : {}
}

function nonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0
}

function def(
  id: string,
  group: ModuleGroupId,
  icon: IconComponent,
  isActive: (config: unknown) => boolean,
  opts: { supportsPause?: boolean; supportsSimulation?: boolean } = {}
): ModuleDefinition {
  return {
    id,
    group,
    path: (guildId) => `/servers/${guildId}/modules/${id}`,
    icon,
    titleKey: `modules.${id}.name`,
    descriptionKey: `modules.${id}.description`,
    supportsPause: opts.supportsPause ?? true,
    supportsSimulation: opts.supportsSimulation ?? false,
    isActive,
  }
}

export const MODULES: readonly ModuleDefinition[] = [
  def('automod_ai', 'moderation', SparklesIcon, (c) => {
    const r = asRec(c)
    const features = asRec(r.features)
    return (
      Object.values(features).some((f) => asRec(f).enabled === true) &&
      Boolean(r.notify_channel_id)
    )
  }, { supportsSimulation: true }),
  def('altguard', 'moderation', FingerprintIcon, (c) => isAltGuardActive(asRec(c))),
  def('adaptive_slowmode', 'moderation', GaugeIcon, (c) => {
    const channels = asRec(c).channels
    return channels !== null && typeof channels === 'object' && Object.keys(channels).length > 0
  }),
  def('logs', 'moderation', ReceiptLongIcon, (c) => isLogsActive(asRec(c))),

  def('welcome_channel', 'welcome', MessageSquareIcon, (c) => isWelcomeActive(c as never)),
  def('welcome_dm', 'welcome', MailIcon, (c) => isWelcomeDmActive(c as never)),
  // Le bot lit `member_roles` / `bot_roles` ; `role_ids` est l'ancien format.
  def('auto_role', 'welcome', UsersIcon, (c) => {
    const r = asRec(c)
    return nonEmptyArray(r.member_roles) || nonEmptyArray(r.bot_roles) || nonEmptyArray(r.role_ids)
  }),
  def('member_applications', 'welcome', UserPlusIcon, isMemberApplicationsActive),

  // Configuré = actif : la config minimale `{configured: true}` suffit.
  def('social_notifications', 'engagement', BellRingIcon, () => true),
  def('starboard', 'engagement', StarIcon, (c) => Boolean(asRec(c).channel_id)),
  def('bump_reminder', 'engagement', RocketIcon, isBumpReminderActive),
  def('tickets', 'engagement', TicketIcon, (c) => isTicketsActive(asRec(c))),

  def('bot_customization', 'customization', PaletteIcon, (c) => isBotCustomizationActive(c as never), {
    supportsPause: false,
  }),
]

export const MODULE_GROUPS: readonly ModuleGroupId[] = [
  'moderation',
  'welcome',
  'engagement',
  'customization',
]

const BY_ID = new Map(MODULES.map((m) => [m.id, m]))

export function getModuleDefinition(id: string): ModuleDefinition | undefined {
  return BY_ID.get(id)
}

/**
 * Statut affiché d'un module. `config` absent ou `{}` = jamais configuré ;
 * `paused` prime ; `simulation` n'existe que pour les modules qui la gèrent ;
 * une config qui ne suffit pas à faire tourner le module est « incomplète ».
 */
export function getModuleStatus(id: string, config: unknown): ModuleStatus {
  const def = BY_ID.get(id)
  if (!config || typeof config !== 'object' || Object.keys(config).length === 0) {
    return 'not_configured'
  }
  const state = readModuleState((config as Rec).state)
  if (state === 'paused' && def?.supportsPause !== false) return 'paused'
  if (!def?.isActive(config)) return 'incomplete'
  if (state === 'simulation' && def.supportsSimulation) return 'simulation'
  return 'active'
}
