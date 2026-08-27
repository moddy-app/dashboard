import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Health check endpoint pour un monitor externe (probe HTTP périodique).
 * Répond 200 tant que la fonction serverless est joignable, sans dépendance
 * externe (pas d'appel au backend Moddy) pour rester rapide et fiable.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).send('ok')
}
