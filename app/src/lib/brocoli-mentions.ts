/**
 * Mentions `#salon` et `@rôle` — saisie assistée et rendu.
 *
 * **Ce qui est mentionnable, et pourquoi.** Le dashboard ne dispose que de deux
 * listes : les salons (`GET /guilds/{id}/channels`) et les rôles
 * (`GET .../roles`), toutes deux déjà chargées par `GuildContext`. Il n'existe
 * **aucun endpoint de liste de membres** — proposer des pseudos exigerait une
 * recherche serveur qui n'existe pas. `@` complète donc les rôles, `#` les
 * salons, et l'utilisateur reste libre d'écrire un pseudo à la main : Brocoli a
 * son propre outil `lookup_member` pour le résoudre.
 *
 * Ce module ne porte que la **logique** (listes, résolution, détection du jeton
 * en cours de frappe) ; la pastille elle-même vit dans
 * `components/brocoli/mention-chip.tsx`.
 *
 * **Ce qui est envoyé est ce qui est écrit.** On insère `#best-of`, pas la
 * syntaxe Discord `<#123>` : Brocoli est un modèle de langage qui lit du texte,
 * et un identifiant nu ne lui apprendrait rien — alors qu'un nom lui suffit,
 * et qu'il peut le résoudre avec `list_channels` / `list_roles`. L'affichage en
 * pastille est donc purement local : on reconnaît les noms qu'on connaît, et un
 * nom inconnu reste du texte, jamais une pastille qui mentirait.
 */

import { createElement, useMemo, type ReactNode } from 'react'
import { MentionChip } from '@/components/brocoli/mention-chip'
import { useGuildContext } from '@/contexts/GuildContext'
import { CHANNEL_TYPES, THREAD_CHANNEL_TYPES } from '@/types/api'

export type { MentionTarget } from '@/components/brocoli/mention-chip'
import type { MentionTarget } from '@/components/brocoli/mention-chip'

/** Résout un nom (sans le préfixe) en cible connue, ou `null`. */
export type MentionResolver = (kind: 'channel' | 'role', name: string) => MentionTarget | null

/** Ce qu'un mentionnable expose à la liste de suggestions. */
export interface MentionSource {
  targets: MentionTarget[]
  resolve: MentionResolver
  /**
   * Résout un **snowflake** en cible connue. Sert au diff d'une action, où le
   * backend renvoie des identifiants nus (`channel_id: "1421493239579676682"`)
   * qu'aucun humain ne sait lire. Un id inconnu rend `null` — on affiche alors
   * l'identifiant tel quel plutôt qu'un nom inventé.
   */
  resolveById: (id: string) => MentionTarget | null
}

/** Salons où un message peut vivre — ni catégorie, ni salon vocal, ni scène. */
const MENTIONABLE_CHANNEL_TYPES = new Set<number>([
  CHANNEL_TYPES.TEXT,
  CHANNEL_TYPES.ANNOUNCEMENT,
  CHANNEL_TYPES.FORUM,
  ...THREAD_CHANNEL_TYPES,
])

/**
 * Construit les listes mentionnables du serveur ouvert. Mémoïsé sur les
 * références de `GuildContext` : le fil se rend à chaque fragment de flux, une
 * reconstruction par frame serait gratuite et coûteuse.
 */
export function useMentionSource(): MentionSource {
  const { channels, roles } = useGuildContext()

  return useMemo(() => {
    const targets: MentionTarget[] = [
      ...channels
        .filter((channel) => MENTIONABLE_CHANNEL_TYPES.has(channel.type))
        .map((channel) => ({ kind: 'channel' as const, id: channel.id, name: channel.name })),
      ...roles
        // `@everyone` n'est pas un rôle qu'on configure, et le proposer
        // inviterait à écrire une mention de masse dans une consigne.
        .filter((role) => role.name !== '@everyone' && !role.managed)
        .map((role) => ({ kind: 'role' as const, id: role.id, name: role.name })),
    ]

    // Index en minuscules : Discord ne distingue pas la casse pour retrouver un
    // salon, et un utilisateur qui tape « @moderateur » attend « Modérateur ».
    const index = new Map<string, MentionTarget>()
    for (const target of targets) {
      index.set(`${target.kind}:${target.name.toLocaleLowerCase()}`, target)
    }

    const byId = new Map<string, MentionTarget>()
    for (const target of targets) byId.set(target.id, target)

    return {
      targets,
      resolve: (kind, name) => index.get(`${kind}:${name.toLocaleLowerCase()}`) ?? null,
      resolveById: (id) => byId.get(id) ?? null,
    }
  }, [channels, roles])
}

// ─── Rendu du texte ───────────────────────────────────────────────────────────

/** Un morceau de texte, mention reconnue ou non. */
export interface MentionSegment {
  text: string
  /** `null` quand le morceau est du texte ordinaire. */
  target: MentionTarget | null
}

/**
 * Découpe un texte en morceaux, en isolant les mentions **connues**.
 *
 * Correspondance par **nom le plus long d'abord** plutôt que par expression
 * régulière : un rôle peut contenir des espaces (« Équipe support »), et un
 * motif `\w+` couperait au premier blanc — donnant une mention « Équipe »
 * suivie d'un « support » orphelin. On tente donc les noms connus, du plus long
 * au plus court, à la position du préfixe.
 *
 * Partagé par les deux rendus : la pastille du fil et le surlignage de la
 * saisie. Les faire diverger ferait mentir l'aperçu de ce qu'on est en train
 * d'écrire.
 */
export function scanMentions(text: string, source: MentionSource | null): MentionSegment[] {
  if (!source || source.targets.length === 0) return [{ text, target: null }]

  // Trié une fois par appel : la liste est petite (quelques dizaines d'entrées)
  // et l'ordre décroissant est ce qui garantit la correspondance la plus longue.
  const sorted = [...source.targets].sort((a, b) => b.name.length - a.name.length)

  const segments: MentionSegment[] = []
  let buffer = ''
  let i = 0

  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, target: null })
      buffer = ''
    }
  }

  while (i < text.length) {
    const char = text[i]
    const isPrefix = char === '#' || char === '@'
    // Un `#` collé à un mot (`abc#def`) n'est pas une mention : Discord non plus
    // ne le traite pas comme telle.
    const atBoundary = i === 0 || /[\s([{«"']/.test(text[i - 1])

    if (isPrefix && atBoundary) {
      const kind = char === '#' ? 'channel' : 'role'
      const rest = text.slice(i + 1)
      const match = sorted.find(
        (target) =>
          target.kind === kind &&
          rest.slice(0, target.name.length).toLocaleLowerCase() ===
            target.name.toLocaleLowerCase() &&
          // Pas de correspondance partielle : le nom doit finir sur une limite.
          !/[\w-]/.test(rest.charAt(target.name.length))
      )

      if (match) {
        flush()
        segments.push({ text: text.slice(i, i + 1 + match.name.length), target: match })
        i += 1 + match.name.length
        continue
      }
    }

    buffer += char
    i++
  }

  flush()
  return segments
}

/** Remplace les mentions connues par des pastilles, pour l'affichage d'un message. */
export function renderMentionText(
  text: string,
  source: MentionSource | null,
  keyPrefix: string,
  /** `true` sur une surface remplie en `primary` (bulle de l'utilisateur). */
  onAccent = false
): ReactNode[] {
  return scanMentions(text, source).map((segment, index) =>
    segment.target
      ? // `createElement` : ce module est un `.ts`, il ne porte pas de JSX.
        createElement(MentionChip, {
          key: `${keyPrefix}-m${index}`,
          target: segment.target,
          onAccent,
        })
      : segment.text
  )
}

// ─── Détection du jeton en cours de saisie ────────────────────────────────────

export interface MentionQuery {
  kind: 'channel' | 'role'
  /** Ce qui a été tapé après le préfixe. */
  term: string
  /** Index du préfixe dans le texte. */
  start: number
  /** Index de fin (position du curseur). */
  end: number
}

/**
 * Jeton de mention à la position du curseur, ou `null`.
 *
 * Le terme accepte les espaces (les rôles en contiennent) mais s'arrête à deux
 * espaces consécutifs et à 32 caractères : sans cette borne, tout le paragraphe
 * qui suit un `@` isolé deviendrait une requête et la liste ne se fermerait
 * jamais.
 */
export function findMentionQuery(text: string, caret: number): MentionQuery | null {
  for (let i = caret - 1; i >= 0 && caret - i <= 33; i--) {
    const char = text[i]
    if (char === '\n') return null

    if (char === '#' || char === '@') {
      const before = i === 0 ? '' : text[i - 1]
      if (before && !/[\s([{«"']/.test(before)) return null
      const term = text.slice(i + 1, caret)
      if (/\s\s/.test(term)) return null
      return { kind: char === '#' ? 'channel' : 'role', term, start: i, end: caret }
    }
  }
  return null
}

/** Suggestions pour un jeton, les plus pertinentes d'abord. */
export function suggestMentions(
  source: MentionSource,
  query: MentionQuery,
  limit = 8
): MentionTarget[] {
  const term = query.term.trim().toLocaleLowerCase()
  const pool = source.targets.filter((target) => target.kind === query.kind)
  if (!term) return pool.slice(0, limit)

  // Les préfixes avant les correspondances internes : taper « mod » doit
  // remonter « Modérateur » avant « auto-mod-logs ».
  const starts: MentionTarget[] = []
  const contains: MentionTarget[] = []
  for (const target of pool) {
    const name = target.name.toLocaleLowerCase()
    if (name.startsWith(term)) starts.push(target)
    else if (name.includes(term)) contains.push(target)
  }
  return [...starts, ...contains].slice(0, limit)
}
