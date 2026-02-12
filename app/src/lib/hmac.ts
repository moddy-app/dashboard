const API_KEY = import.meta.env.VITE_API_KEY || ''

/**
 * Trie récursivement toutes les clés d'un objet (alphabétiquement)
 * Nécessaire pour que le backend et le frontend signent la même chose
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
 * Génère une signature HMAC-SHA256 pour les requêtes API
 * Utilise l'API Web Crypto disponible dans les navigateurs modernes
 *
 * Format attendu par le backend :
 * - Clés triées alphabétiquement (récursif)
 * - JSON avec espaces : {"body": {...}, "request_id": "..."}
 * - Utilise request_id (avec underscore, pas camelCase)
 */
export async function generateSignature(
  requestId: string,
  body: any = {}
): Promise<string> {
  // 1. Créer le payload avec les clés dans le bon ordre
  const payloadObj = {
    request_id: requestId, // ⚠️ underscore, pas camelCase
    body: body,
  }

  // 2. Trier toutes les clés récursivement
  const sortedPayload = sortKeys(payloadObj)

  // 3. Sérialiser en JSON
  // JSON.stringify() ajoute automatiquement des espaces après : et ,
  const payload = JSON.stringify(sortedPayload)

  // 4. Générer la signature HMAC-SHA256 avec Web Crypto API
  try {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(API_KEY)
    const messageData = encoder.encode(payload)

    // Importer la clé
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    // Signer le message
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)

    // Convertir en hexadécimal
    const hashArray = Array.from(new Uint8Array(signature))
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')

    return hashHex
  } catch (error) {
    console.error('Error generating HMAC signature:', error)
    throw new Error('Failed to generate signature')
  }
}

/**
 * Génère un UUID v4 unique pour identifier la requête
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}
