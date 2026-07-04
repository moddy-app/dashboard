import { api } from '@/lib/auth'
import type {
  CasesMeta,
  Case,
  CaseListItem,
  CaseDetail,
  CaseFilters,
  CaseCreateInput,
  CasePatchInput,
  SanctionCreateInput,
  DiscordUserProfile,
  DiscordGuildProfile,
} from '@/types/cases'

// ─── Meta ────────────────────────────────────────────────────────────────────
// Source de vérité des formulaires (types × actions autorisées, temporisables…).
// Mise en cache module-level : la meta ne change pas pendant une session.

let metaCache: CasesMeta | null = null
let metaPromise: Promise<CasesMeta> | null = null

export async function getCasesMeta(): Promise<CasesMeta> {
  if (metaCache) return metaCache
  if (!metaPromise) {
    metaPromise = (api('/cases/meta') as Promise<CasesMeta>)
      .then((m) => {
        metaCache = m
        return m
      })
      .catch((e) => {
        metaPromise = null
        throw e
      })
  }
  return metaPromise
}

// ─── Cases ─────────────────────────────────────────────────────────────────────

export async function getCases(filters: CaseFilters = {}): Promise<CaseListItem[]> {
  const query = new URLSearchParams()
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.set(k, String(v))
  })
  const qs = query.toString()
  return (await api(`/cases${qs ? `?${qs}` : ''}`)) as CaseListItem[]
}

/** `identifier` = référence (6 caractères) ou UUID. */
export async function getCase(identifier: string): Promise<CaseDetail> {
  return (await api(`/cases/${encodeURIComponent(identifier)}`)) as CaseDetail
}

export async function createCase(input: CaseCreateInput): Promise<CaseDetail> {
  return (await api('/cases', {
    method: 'POST',
    body: JSON.stringify(input),
  })) as CaseDetail
}

export async function patchCase(identifier: string, input: CasePatchInput): Promise<CaseDetail> {
  return (await api(`/cases/${encodeURIComponent(identifier)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })) as CaseDetail
}

export async function addSanction(
  identifier: string,
  input: SanctionCreateInput
): Promise<CaseDetail> {
  return (await api(`/cases/${encodeURIComponent(identifier)}/sanctions`, {
    method: 'POST',
    body: JSON.stringify(input),
  })) as CaseDetail
}

export async function revokeSanction(
  identifier: string,
  sanctionId: string,
  note?: string
): Promise<CaseDetail> {
  return (await api(
    `/cases/${encodeURIComponent(identifier)}/sanctions/${sanctionId}/revoke`,
    {
      method: 'POST',
      body: JSON.stringify(note ? { note } : {}),
    }
  )) as CaseDetail
}

export async function addNote(identifier: string, content: string): Promise<CaseDetail> {
  return (await api(`/cases/${encodeURIComponent(identifier)}/notes`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })) as CaseDetail
}

// ─── Blacklist (staff, lecture seule) ────────────────────────────────────────────

export interface BlacklistRow {
  id: string
  reference: string
  type: Case['type']
  subject_type: Case['subject_type']
  subject_id: string
  issuer_type: Case['issuer_type']
  issuer_id: string | null
  reason: string
  status: Case['status']
  created_at: string
  sanction_id: string
  action: string
  expires_at: string | null
  sanctioned_at: string | null
  issued_by_type: string
  issued_by_id: string | null
}

export async function getStaffBlacklist(limit = 50, offset = 0): Promise<BlacklistRow[]> {
  return (await api(`/staff/blacklist?limit=${limit}&offset=${offset}`)) as BlacklistRow[]
}

// ─── Profils ─────────────────────────────────────────────────────────────────────

export async function getUserProfile(userId: string): Promise<DiscordUserProfile> {
  return (await api(`/users/${userId}/profile`)) as DiscordUserProfile
}

export async function getGuildProfile(guildId: string): Promise<DiscordGuildProfile> {
  return (await api(`/guilds/${guildId}/profile`)) as DiscordGuildProfile
}
