import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomUUID } from 'crypto'

const API_URL = process.env.API_URL || 'https://api.moddy.app'
const API_KEY = process.env.API_KEY || ''
const ALLOWED_ENDPOINTS = new Set(['/api/website/auth/init'])
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS ||
    'https://moddy.app,https://www.moddy.app,https://dashboard.moddy.app')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
)
const MAX_BODY_BYTES = 16 * 1024

function setSecurityHeaders(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : ''
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return false
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
  return true
}

/**
 * Trie récursivement toutes les clés d'un objet (alphabétiquement)
 */
function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj
  }
  return Object.keys(obj)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortKeys((obj as Record<string, unknown>)[key])
      return result
    }, {})
}

/**
 * Génère une signature HMAC-SHA256
 */
function generateSignature(
  requestId: string,
  body: Record<string, unknown> = {},
): string {
  const payloadObj = {
    request_id: requestId,
    body: body,
  }

  const sortedPayload = sortKeys(payloadObj)
  const payload = JSON.stringify(sortedPayload)

  const signature = createHmac('sha256', API_KEY)
    .update(payload)
    .digest('hex')

  return signature
}

/**
 * Proxy sécurisé vers le backend Moddy
 * La clé API n'est jamais exposée au client
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  setSecurityHeaders(res)
  const corsAllowed = setCorsHeaders(req, res)

  if (req.method === 'OPTIONS') {
    return corsAllowed ? res.status(204).end() : res.status(403).end()
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (req.headers.origin && !corsAllowed) {
    return res.status(403).json({ error: 'Origin not allowed' })
  }
  if (API_KEY.length < 32) {
    console.error('API_KEY is missing or too short')
    return res.status(503).json({ error: 'Service unavailable' })
  }

  try {
    const requestBody: unknown = req.body
    if (
      requestBody === null ||
      typeof requestBody !== 'object' ||
      Array.isArray(requestBody)
    ) {
      return res.status(400).json({ error: 'Invalid request body' })
    }
    const { endpoint, body } = requestBody as Record<string, unknown>

    if (typeof endpoint !== 'string' || !ALLOWED_ENDPOINTS.has(endpoint)) {
      return res.status(400).json({ error: 'Endpoint is not allowed' })
    }
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({ error: 'Body must be an object' })
    }
    const bodyObject = body as Record<string, unknown>
    if (Buffer.byteLength(JSON.stringify(bodyObject), 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({ error: 'Request body too large' })
    }
    if (typeof bodyObject.current_page !== 'string') {
      return res.status(400).json({ error: 'current_page is required' })
    }
    try {
      const currentPage = new URL(bodyObject.current_page)
      if (!ALLOWED_ORIGINS.has(currentPage.origin)) {
        return res.status(400).json({ error: 'current_page origin is not allowed' })
      }
    } catch {
      return res.status(400).json({ error: 'current_page is invalid' })
    }

    // Générer la signature côté serveur
    const requestId = randomUUID()
    const signature = generateSignature(requestId, bodyObject)

    // Forward vers le backend avec la signature
    const backendResponse = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Signature': signature,
      },
      body: JSON.stringify(bodyObject),
      signal: AbortSignal.timeout(10_000),
    })

    const contentType = backendResponse.headers.get('content-type') || ''
    const data = contentType.includes('application/json')
      ? await backendResponse.json()
      : { error: 'Invalid backend response' }

    // Retourner la réponse du backend
    return res.status(backendResponse.status).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
