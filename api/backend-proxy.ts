import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createHmac, randomUUID } from 'crypto'

const API_URL = process.env.API_URL || 'https://api.moddy.app'
const API_KEY = process.env.API_KEY || ''

/**
 * Trie récursivement toutes les clés d'un objet (alphabétiquement)
 */
function sortKeys(obj: any): any {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return obj
  }
  return Object.keys(obj)
    .sort()
    .reduce((result: any, key: string) => {
      result[key] = sortKeys(obj[key])
      return result
    }, {})
}

/**
 * Génère une signature HMAC-SHA256
 */
function generateSignature(requestId: string, body: any = {}): string {
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
  // Vérifier la méthode
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  try {
    const { endpoint, body } = req.body

    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint is required' })
    }

    // Générer la signature côté serveur
    const requestId = randomUUID()
    const signature = generateSignature(requestId, body)

    // Forward vers le backend avec la signature
    const backendResponse = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': requestId,
        'X-Signature': signature,
      },
      body: JSON.stringify(body),
    })

    const data = await backendResponse.json()

    // Retourner la réponse du backend
    return res.status(backendResponse.status).json(data)
  } catch (error) {
    console.error('Proxy error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
