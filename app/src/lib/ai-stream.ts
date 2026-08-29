/**
 * Client SSE des deux endpoints de tour de Brocoli.
 *
 * ⚠️ **`EventSource` ne convient pas.** Il ne sait faire que des `GET`, sans
 * corps ni en-tête personnalisé, alors que `POST …/messages` et
 * `POST …/decision` sont des `POST` avec un corps JSON. On lit donc le
 * `ReadableStream` de `fetch` et on parse le SSE à la main.
 *
 * Corollaire : **pas de reconnexion automatique**. Si la connexion tombe en
 * plein tour, le travail déjà fait est persisté côté backend — la reprise se
 * fait par `GET /ai/conversations/{id}`, jamais en rejouant le message.
 */

import { API_BASE, parseApiJson, redirectToLogin } from '@/lib/auth'
import { logger } from '@/lib/logger'
import type { RawSseEvent } from '@/types/ai'

/**
 * Erreur levée quand la réponse n'est **pas** un flux. Les erreurs de Brocoli
 * arrivent toutes *avant* le flux, en JSON normal (`{"error": "…"}`) : on les
 * remonte avec leur statut pour que l'appelant les traite normalement.
 */
export class AiStreamError extends Error {
  readonly status: number
  readonly payload: Record<string, unknown>
  /** Secondes avant réessai, lu sur l'en-tête `Retry-After` d'un `429`. */
  readonly retryAfter: number | null

  constructor(
    status: number,
    message: string,
    payload: Record<string, unknown> = {},
    retryAfter: number | null = null
  ) {
    super(message)
    this.name = 'AiStreamError'
    this.status = status
    this.payload = payload
    this.retryAfter = retryAfter
  }

  /** Coupure réseau ou flux interrompu — distinct d'un refus du backend. */
  get isTransport(): boolean {
    return this.status === 0
  }
}

/**
 * Découpe un tampon SSE en événements complets et rend le reste non consommé.
 *
 * Les événements sont séparés par une ligne vide, mais **un événement peut être
 * coupé en deux paquets réseau** : sans ce report du reste, des fragments se
 * perdent au hasard, d'autant plus souvent que le réseau est mauvais. Exporté
 * pour rester testable isolément.
 */
export function splitSseChunks(buffer: string): { chunks: string[]; rest: string } {
  // Le backend peut normaliser en CRLF derrière un proxy : on aligne avant de
  // découper, sinon le séparateur « \n\n » ne matche jamais.
  const normalized = buffer.replace(/\r\n/g, '\n')
  const parts = normalized.split('\n\n')
  return { chunks: parts.slice(0, -1), rest: parts[parts.length - 1] ?? '' }
}

/**
 * Parse un bloc SSE. Rend `null` si le bloc ne porte aucune donnée (commentaire
 * de keep-alive `:` ou champ `id:`/`retry:` seul).
 */
function parseSseChunk(chunk: string): RawSseEvent | null {
  let name = 'message'
  const dataLines: string[] = []

  for (const line of chunk.split('\n')) {
    if (line.startsWith(':')) continue // commentaire / keep-alive
    if (line.startsWith('event:')) name = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }

  if (dataLines.length === 0) return null

  try {
    // `parseApiJson` plutôt que `JSON.parse` : les snowflakes d'un `tool_call`
    // dépassent 2^53 et seraient arrondis silencieusement.
    return { event: name, data: parseApiJson(dataLines.join('\n')) }
  } catch {
    // Une ligne illisible ne doit pas tuer un tour à moitié rendu.
    logger.warn('brocoli', 'SSE: ligne de données illisible, ignorée', chunk)
    return null
  }
}

interface StreamPostOptions {
  signal?: AbortSignal
}

/**
 * `POST` qui rend un flux SSE. `onEvent` est appelé au fil de l'eau.
 *
 * Résout quand le flux se termine normalement. Lève une `AiStreamError` si la
 * réponse n'est pas un flux (403, 409, 429, 503…) ou si le transport casse en
 * cours de route.
 */
export async function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: RawSseEvent) => void,
  { signal }: StreamPostOptions = {}
): Promise<void> {
  const start = performance.now()
  logger.api('brocoli', `→ POST ${path}`, body)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      // Sans ça, le cookie de session ne part pas et tout répond 401.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if (signal?.aborted) throw e
    logger.error('brocoli', `✗ POST ${path} — erreur réseau`, e)
    throw new AiStreamError(0, 'network')
  }

  // Les erreurs arrivent AVANT le flux, en JSON normal.
  if (!response.ok) {
    if (response.status === 401) {
      redirectToLogin()
      throw new AiStreamError(401, 'unauthorized')
    }
    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
    const raw = payload.error
    const message = typeof raw === 'string' && raw ? raw : `HTTP ${response.status}`
    const header = Number(response.headers.get('Retry-After'))
    logger.error('brocoli', `← POST ${path} ${response.status}`, payload)
    throw new AiStreamError(
      response.status,
      message,
      payload,
      Number.isFinite(header) && header > 0 ? header : null
    )
  }

  if (!response.body) {
    throw new AiStreamError(0, 'stream_error')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      const { chunks, rest } = splitSseChunks(buffer)
      buffer = rest

      for (const chunk of chunks) {
        const parsed = parseSseChunk(chunk)
        if (parsed) onEvent(parsed)
      }
    }

    // Dernier bloc si le flux se ferme sans ligne vide terminale.
    const tail = parseSseChunk(buffer.replace(/\r\n/g, '\n'))
    if (tail) onEvent(tail)
  } catch (e) {
    // Un abort est une décision de l'appelant, pas une panne : on le relaie tel
    // quel pour qu'il ne se confonde pas avec une coupure réseau.
    if (signal?.aborted) throw e
    logger.error('brocoli', `✗ POST ${path} — flux interrompu`, e)
    throw new AiStreamError(0, 'stream_error')
  } finally {
    reader.releaseLock()
    logger.success('brocoli', `← POST ${path} ${Math.round(performance.now() - start)}ms`)
  }
}
