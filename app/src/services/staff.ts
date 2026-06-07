import { api } from '@/lib/auth'
import type {
  GlobalStats,
  UserFullProfile,
  ModerationCase,
  BotStatus,
  GuildDetail,
  GuildAttributes,
  BlacklistEntry,
  TallyForm,
  TallySubmissionsResponse,
  TallySubmissionDetail,
  TallySubmissionItem,
  TallySubmissionStatus,
} from '@/types/api'

// ─── Guard ────────────────────────────────────────────────────────────────────

export function requireStaff(isStaff: boolean) {
  if (!isStaff) throw new Error('Access denied — staff only')
}

// ─── Guilds (staff) ───────────────────────────────────────────────────────────

export async function getAllGuilds(params?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<GuildDetail[]> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.limit) query.set('limit', String(params.limit))
  if (params?.offset) query.set('offset', String(params.offset))
  return (await api(`/staff/guilds?${query.toString()}`)) as GuildDetail[]
}

export async function getGuildStaff(guildId: string | number): Promise<{
  guild_id: number
  attributes: GuildAttributes
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}> {
  return (await api(`/staff/guilds/${guildId}`)) as {
    guild_id: number
    attributes: GuildAttributes
    data: Record<string, unknown>
    created_at: string
    updated_at: string
  }
}

export async function updateGuildAttributes(
  guildId: string | number,
  attrs: Partial<{ PREMIUM: true | null; BETA: true | null; BLACKLISTED: true | null }>
): Promise<void> {
  await api(`/staff/guilds/${guildId}`, {
    method: 'PATCH',
    body: JSON.stringify(attrs),
  })
}

// ─── Blacklist ────────────────────────────────────────────────────────────────

export async function getBlacklist(
  limit = 50,
  offset = 0
): Promise<BlacklistEntry[]> {
  return (await api(
    `/staff/blacklist?limit=${limit}&offset=${offset}`
  )) as BlacklistEntry[]
}

export async function addToBlacklist(params: {
  entity_type: 'user' | 'guild'
  entity_id: number
  reason?: string
  sanction_type?: 'global_blacklist' | 'guild_blacklist'
}): Promise<void> {
  await api('/staff/blacklist', {
    method: 'POST',
    body: JSON.stringify(params),
  })
}

export async function removeFromBlacklist(caseId: string): Promise<void> {
  await api(`/staff/blacklist/${caseId}`, { method: 'DELETE' })
}

// ─── Cases ────────────────────────────────────────────────────────────────────

export async function getCases(filters?: {
  entity_id?: number
  entity_type?: 'user' | 'guild'
  case_type?: 'global' | 'interserver'
  status?: 'open' | 'closed'
  limit?: number
  offset?: number
}): Promise<ModerationCase[]> {
  const query = new URLSearchParams()
  if (filters) {
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v))
    })
  }
  return (await api(`/cases?${query.toString()}`)) as ModerationCase[]
}

export async function getCase(caseId: string): Promise<ModerationCase> {
  return (await api(`/cases/${caseId}`)) as ModerationCase
}

// ─── Users (staff) ────────────────────────────────────────────────────────────

export async function searchUsers(
  query: string,
  limit = 50,
  offset = 0
): Promise<UserFullProfile[]> {
  return (await api(
    `/staff/users?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`
  )) as UserFullProfile[]
}

export async function getUserProfile(
  userId: string | number
): Promise<UserFullProfile> {
  return (await api(`/staff/users/${userId}`)) as UserFullProfile
}

export async function updateUserAttributes(
  userId: string | number,
  attrs: Record<string, true | string | null>
): Promise<void> {
  await api(`/staff/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(attrs),
  })
}

// ─── Stats globales ───────────────────────────────────────────────────────────

export async function getGlobalStats(): Promise<GlobalStats> {
  return (await api('/staff/stats')) as GlobalStats
}

// ─── Bot Discord ──────────────────────────────────────────────────────────────

export async function getBotStatus(): Promise<BotStatus> {
  return (await api('/staff/bot/status')) as BotStatus
}

export async function sendAnnouncement(
  message: string,
  guildIds?: number[]
): Promise<void> {
  await api('/staff/bot/announce', {
    method: 'POST',
    body: JSON.stringify({
      message,
      guild_ids: guildIds ?? null,
    }),
  })
}

// ─── Tally (Formulaires/Candidatures) ────────────────────────────────────────

export async function getTallyForms(): Promise<TallyForm[]> {
  return (await api('/staff/tally/forms')) as TallyForm[]
}

export async function getTallySubmissions(
  formId: string,
  limit = 50,
  offset = 0
): Promise<TallySubmissionsResponse> {
  return (await api(
    `/staff/tally/forms/${formId}/submissions?limit=${limit}&offset=${offset}`
  )) as TallySubmissionsResponse
}

export async function getTallySubmission(
  submissionId: string
): Promise<TallySubmissionDetail> {
  return (await api(`/staff/tally/submissions/${submissionId}`)) as TallySubmissionDetail
}

export async function updateTallySubmission(
  submissionId: string,
  data: { status?: TallySubmissionStatus; note?: string }
): Promise<TallySubmissionItem> {
  return (await api(`/staff/tally/submissions/${submissionId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })) as TallySubmissionItem
}

export async function registerTallyForm(
  formId: string,
  data: { title: string; signing_secret: string }
): Promise<TallyForm> {
  return (await api(`/staff/tally/forms/${formId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })) as TallyForm
}
