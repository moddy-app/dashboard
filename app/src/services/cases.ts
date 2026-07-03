import type {
  AddSanctionInput,
  ApiError,
  BlacklistEntry,
  CaseDetail,
  CaseListItem,
  CasesMeta,
  CasesQuery,
  CreateCaseInput,
  GuildProfile,
  UserProfile,
} from "./cases-types"

const API_URL = import.meta.env.VITE_API_URL || ""

function makeError(message: string, status: number, detail?: unknown): ApiError {
  const err = new Error(message) as ApiError
  err.status = status
  err.detail = detail
  return err
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      credentials: "include",
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    })
  } catch {
    throw makeError("Impossible de joindre le serveur.", 0)
  }

  const isJson = res.headers
    .get("content-type")
    ?.includes("application/json")
  const data = isJson ? await res.json().catch(() => null) : null

  if (!res.ok) {
    const message =
      (data && (data.error as string)) || `Erreur ${res.status}`
    throw makeError(message, res.status, data?.detail)
  }

  return data as T
}

function buildQuery(query: Record<string, unknown> = {}): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue
    params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ""
}

// ── Cases ──────────────────────────────────────────────────────────

export function getCasesMeta(): Promise<CasesMeta> {
  return request<CasesMeta>("/cases/meta")
}

export function listCases(query: CasesQuery = {}): Promise<CaseListItem[]> {
  return request<CaseListItem[]>(
    `/cases${buildQuery(query as Record<string, unknown>)}`
  )
}

export function getCase(identifier: string): Promise<CaseDetail> {
  return request<CaseDetail>(`/cases/${encodeURIComponent(identifier)}`)
}

export function createCase(input: CreateCaseInput): Promise<CaseDetail> {
  return request<CaseDetail>("/cases", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function patchCase(
  identifier: string,
  input: { reason?: string; status?: "open" | "closed" }
): Promise<CaseDetail> {
  return request<CaseDetail>(`/cases/${encodeURIComponent(identifier)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  })
}

export function addSanction(
  identifier: string,
  input: AddSanctionInput
): Promise<CaseDetail> {
  return request<CaseDetail>(
    `/cases/${encodeURIComponent(identifier)}/sanctions`,
    { method: "POST", body: JSON.stringify(input) }
  )
}

export function revokeSanction(
  identifier: string,
  sanctionId: string,
  note?: string
): Promise<CaseDetail> {
  return request<CaseDetail>(
    `/cases/${encodeURIComponent(identifier)}/sanctions/${sanctionId}/revoke`,
    { method: "POST", body: JSON.stringify({ note }) }
  )
}

export function addNote(
  identifier: string,
  content: string
): Promise<CaseDetail> {
  return request<CaseDetail>(
    `/cases/${encodeURIComponent(identifier)}/notes`,
    { method: "POST", body: JSON.stringify({ content }) }
  )
}

// ── Blacklist & Profils ────────────────────────────────────────────

export function listBlacklist(
  query: { limit?: number; offset?: number } = {}
): Promise<BlacklistEntry[]> {
  return request<BlacklistEntry[]>(`/staff/blacklist${buildQuery(query)}`)
}

export function getUserProfile(userId: string): Promise<UserProfile> {
  return request<UserProfile>(`/users/${encodeURIComponent(userId)}/profile`)
}

export function getGuildProfile(guildId: string): Promise<GuildProfile> {
  return request<GuildProfile>(`/guilds/${encodeURIComponent(guildId)}/profile`)
}
