/**
 * Helpers purs du module Brocoli : normalisation défensive des payloads du
 * flux, libellés d'outils, apparence des niveaux de risque, rendu des valeurs
 * de diff.
 *
 * Tout ce qui touche au réseau vit dans `src/services/ai.ts` et
 * `src/lib/ai-stream.ts` ; tout ce qui touche au rendu, dans
 * `src/components/brocoli/`.
 */

import {
  AlertTriangleIcon,
  InfoIcon,
  OctagonAlertIcon,
  BookOpenIcon,
  FileCogIcon,
  FileSearch2Icon,
  HashIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
  UserSearchIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react'
import { ACTION_TONE } from '@/lib/cases'
import type {
  AiActionPreview,
  AiActionStatus,
  AiDiffEntry,
  AiPermissionRequest,
  AiRisk,
  AiRunStatus,
  AiStreamErrorCode,
  AiTranscriptMessage,
  BrocoliItem,
} from '@/types/ai'

// ─── Lecture défensive ────────────────────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/**
 * Un `risk` inconnu dégrade vers `high`, **jamais** vers `low` : minimiser une
 * action qu'on ne sait pas classer est exactement la mauvaise direction. Le
 * backend peut introduire un niveau sans coordonner un déploiement du front.
 */
export function normalizeRisk(value: unknown): AiRisk {
  return value === 'low' || value === 'high' || value === 'critical' ? value : 'high'
}

/** Un statut inconnu est traité comme non décidable (`failed`). */
export function normalizeActionStatus(value: unknown): AiActionStatus {
  const known: AiActionStatus[] = [
    'pending',
    'approved',
    'denied',
    'expired',
    'executed',
    'failed',
  ]
  return known.includes(value as AiActionStatus) ? (value as AiActionStatus) : 'failed'
}

export function normalizeRunStatus(value: unknown): AiRunStatus {
  const known: AiRunStatus[] = ['completed', 'awaiting_confirmation', 'error', 'max_iterations']
  return known.includes(value as AiRunStatus) ? (value as AiRunStatus) : 'error'
}

function normalizeDiff(value: unknown): AiDiffEntry[] | null {
  if (!Array.isArray(value)) return null
  const entries = value.flatMap((raw): AiDiffEntry[] => {
    const row = asRecord(raw)
    const path = asString(row.path)
    if (path === null) return []
    const op = row.op === 'added' || row.op === 'removed' || row.op === 'changed' ? row.op : 'changed'
    return [{ path, op, before: row.before ?? null, after: row.after ?? null }]
  })
  return entries
}

function normalizeErrors(value: unknown): string[] | null {
  if (typeof value === 'string') return [value]
  if (!Array.isArray(value)) return null
  const out = value.map((e) => (typeof e === 'string' ? e : JSON.stringify(e))).filter(Boolean)
  return out.length > 0 ? out : null
}

function normalizePreview(value: unknown, fallbackSummary: string): AiActionPreview {
  const raw = asRecord(value)
  return {
    summary: asString(raw.summary) ?? fallbackSummary,
    module_id: asString(raw.module_id),
    // `valid` absent ≠ `false` : seule une invalidité **explicite** grise le
    // bouton « Appliquer ». Une action sans validation (facturation, sanction)
    // n'a pas de `valid` et doit rester applicable.
    valid: typeof raw.valid === 'boolean' ? raw.valid : null,
    errors: normalizeErrors(raw.errors),
    diff: normalizeDiff(raw.diff),
  }
}

/** Normalise un `permission_request` du flux. */
export function normalizePermissionRequest(raw: unknown): AiPermissionRequest | null {
  const row = asRecord(raw)
  const actionId = asString(row.action_id)
  if (!actionId) return null
  return {
    action_id: actionId,
    kind: asString(row.kind) ?? 'unknown',
    risk: normalizeRisk(row.risk),
    status: normalizeActionStatus(row.status ?? 'pending'),
    requires_confirmation: row.requires_confirmation !== false,
    expires_at: asString(row.expires_at),
    preview: normalizePreview(row.preview, ''),
  }
}

/**
 * Reconstruit une action depuis un message de rôle `action` du transcript.
 *
 * ⚠️ Le transcript ne porte **ni `preview.diff` ni `expires_at`** : il donne
 * `{action_id, kind, risk, status, summary, call_id}`. On rend donc une action
 * réduite — résumé seul, sans compte à rebours. N'inventer aucun aperçu à
 * partir de `kind` : mieux vaut « pas de détail disponible » qu'un aperçu faux
 * sur une action irréversible.
 */
export function actionFromTranscript(content: Record<string, unknown>): AiPermissionRequest | null {
  const actionId = asString(content.action_id)
  if (!actionId) return null
  return {
    action_id: actionId,
    kind: asString(content.kind) ?? 'unknown',
    risk: normalizeRisk(content.risk),
    status: normalizeActionStatus(content.status),
    requires_confirmation: content.requires_confirmation !== false,
    expires_at: asString(content.expires_at),
    preview: normalizePreview(content.preview, asString(content.summary) ?? ''),
  }
}

/**
 * Transcript de l'API → items affichables.
 *
 * Les étapes d'outil n'y figurent pas : elles ne sont pas persistées et
 * n'avaient d'intérêt que pendant l'attente.
 */
export function itemsFromTranscript(messages: AiTranscriptMessage[]): BrocoliItem[] {
  return messages.flatMap((message): BrocoliItem[] => {
    const id = `m${message.id}`
    if (message.role === 'user') {
      const text = asString(message.content.text) ?? ''
      return text ? [{ kind: 'user', id, text, created_at: message.created_at }] : []
    }
    if (message.role === 'assistant') {
      const text = asString(message.content.text) ?? ''
      return text ? [{ kind: 'assistant', id, text, streaming: false }] : []
    }
    const action = actionFromTranscript(message.content)
    return action ? [{ kind: 'action', id, action, submitted: null }] : []
  })
}

// ─── Outils ───────────────────────────────────────────────────────────────────

/**
 * `tool_call.name` est un identifiant technique : on affiche un libellé, jamais
 * le nom brut. Chaque entrée pointe une clé i18n (`brocoli.tools.<name>`) et
 * une icône ; un outil inconnu — le backend peut en ajouter — retombe sur un
 * libellé générique plutôt que de disparaître.
 */
export const TOOL_META = {
  list_channels: HashIcon,
  list_roles: UsersIcon,
  lookup_member: UserSearchIcon,
  get_bot_capabilities: KeyRoundIcon,
  get_module_config: FileCogIcon,
  get_module_schema: FileSearch2Icon,
  validate_module_config: ShieldCheckIcon,
  search_documentation: BookOpenIcon,
  read_documentation_page: ScrollTextIcon,
  read_internal_guide: ScrollTextIcon,
  get_guild_overview: LayoutDashboardIcon,
} as const satisfies Record<string, typeof WrenchIcon>

export function toolIcon(name: string): typeof WrenchIcon {
  return (TOOL_META as Record<string, typeof WrenchIcon>)[name] ?? WrenchIcon
}

/** Clé i18n du libellé d'un outil ; `brocoli.tools.default` sert de repli. */
export function toolLabelKey(name: string): string {
  return name in TOOL_META ? `brocoli.tools.${name}` : 'brocoli.tools.default'
}

// ─── Risque ───────────────────────────────────────────────────────────────────

/**
 * Trois niveaux, trois traitements visuels **distincts** — c'est ce qui
 * distingue une confirmation d'un clic réflexe.
 *
 * La palette est celle des cases (`ACTION_TONE`) : le dashboard n'a qu'un jeu
 * de tons, une alerte doit avoir la même couleur partout.
 */
export const RISK_META = {
  // `badge` est une variante **stock** de `Badge` : les trois niveaux se
  // distinguent par la hiérarchie visuelle déjà définie par le design system
  // (trait → plein discret → destructif), sans classe de couleur recopiée à la
  // main. `tone` reste utilisé là où il faut une couleur seule (icône d'une
  // trace dans le fil).
  low: { tone: 'sky', icon: InfoIcon, badge: 'outline' },
  high: { tone: 'amber', icon: AlertTriangleIcon, badge: 'secondary' },
  critical: { tone: 'red', icon: OctagonAlertIcon, badge: 'destructive' },
} as const satisfies Record<
  AiRisk,
  {
    tone: keyof typeof ACTION_TONE
    icon: typeof InfoIcon
    badge: 'outline' | 'secondary' | 'destructive'
  }
>

export function riskTone(risk: AiRisk) {
  return ACTION_TONE[RISK_META[risk].tone]
}

/**
 * Une action `critical` (remboursement, résiliation, sanction, annonce,
 * indications de l'automod IA) exige un **geste délibéré** : elle reste
 * confirmée même en mode `auto`, donc l'utilisateur ne s'y attend pas et ne
 * doit pas pouvoir l'approuver d'un clic réflexe.
 */
export function requiresDeliberateGesture(risk: AiRisk): boolean {
  return risk === 'critical'
}

/**
 * « Appliquer » n'est grisé que sur une invalidité **explicite** : laisser
 * cliquer produirait un échec que l'utilisateur ne comprendrait pas.
 */
export function isPreviewBlocking(preview: AiActionPreview): boolean {
  return preview.valid === false
}

// ─── Expiration ───────────────────────────────────────────────────────────────

/**
 * Secondes restantes avant expiration, ou `null` si l'action n'en porte pas
 * (cas d'une relecture de transcript) ou si la date est illisible. `0` = expirée.
 */
export function secondsUntil(expiresAt: string | null, now = Date.now()): number | null {
  if (!expiresAt) return null
  const target = Date.parse(expiresAt)
  if (Number.isNaN(target)) return null
  return Math.max(0, Math.round((target - now) / 1000))
}

/** `m:ss` — assez court pour un compte à rebours, assez lisible pour être lu. */
export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Une action n'est décidable que `pending` et non expirée. */
export function isActionDecidable(action: AiPermissionRequest, now = Date.now()): boolean {
  if (action.status !== 'pending') return false
  const left = secondsUntil(action.expires_at, now)
  return left === null || left > 0
}

// ─── Rendu des valeurs de diff ────────────────────────────────────────────────

/**
 * Une valeur de diff rendue en texte, plus un drapeau disant si elle mérite un
 * repli. Une **liste qui change est rendue entière** (aligner des panneaux par
 * index produirait un diff faux dès qu'on en insère un au milieu), d'où des
 * valeurs parfois longues.
 */
export interface DiffValueRender {
  text: string
  /** `true` quand la valeur est un objet/tableau, ou dépasse une ligne. */
  expandable: boolean
  /** `true` pour une valeur absente — rendue en « — », jamais en « null ». */
  empty: boolean
}

const COLLAPSE_THRESHOLD = 80

export function renderDiffValue(value: unknown): DiffValueRender {
  if (value === null || value === undefined) {
    return { text: '—', expandable: false, empty: true }
  }
  if (typeof value === 'string') {
    // Une chaîne vide est une vraie valeur, distincte de l'absence : on la
    // montre comme telle plutôt que de la confondre avec « — ».
    const text = value === '' ? '""' : value
    return { text, expandable: text.length > COLLAPSE_THRESHOLD, empty: false }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return { text: String(value), expandable: false, empty: false }
  }
  const text = JSON.stringify(value, null, 2) ?? String(value)
  return { text, expandable: true, empty: false }
}

// ─── Erreurs ──────────────────────────────────────────────────────────────────

/**
 * Un `409` a **deux causes** qu'il ne faut pas confondre — un tour déjà en
 * cours (autre onglet, flux précédent encore ouvert) ou une action déjà
 * décidée / expirée. Le message du backend les distingue : on l'affiche tel
 * quel et on se sert de cette lecture uniquement pour choisir l'action
 * proposée (rafraîchir la conversation dans les deux cas, mais le libellé
 * diffère).
 */
export function conflictKind(message: string): 'run_in_progress' | 'action_settled' {
  return /action/i.test(message) ? 'action_settled' : 'run_in_progress'
}

const STREAM_ERROR_CODES: AiStreamErrorCode[] = [
  'timeout',
  'network',
  'rate_limited',
  'upstream',
  'bad_request',
  'stream_error',
  'ai_unavailable',
  'internal',
]

/** Un code inconnu retombe sur `internal` plutôt que d'être affiché nu. */
export function normalizeStreamErrorCode(value: unknown): AiStreamErrorCode {
  return STREAM_ERROR_CODES.includes(value as AiStreamErrorCode)
    ? (value as AiStreamErrorCode)
    : 'internal'
}

/** Clé i18n d'un code d'erreur du flux ; repli sur un message générique. */
export function streamErrorKey(code: AiStreamErrorCode | 'max_iterations'): string {
  return `brocoli.streamErrors.${code}`
}
