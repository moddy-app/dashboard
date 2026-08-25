import type { VercelRequest, VercelResponse } from '@vercel/node'

/**
 * Health check endpoint pour un monitor externe (probe HTTP périodique).
 *
 * Contraintes à respecter strictement (cf. /api/README.md) :
 * - Répond toujours 200, sans dépendance à une ressource externe (pas d'appel
 *   au backend Moddy, pas de DB) : ce endpoint atteste seulement que le
 *   déploiement statique/serverless répond, pas que le backend est up.
 * - Aucune authentification, aucun CORS bloquant (le monitor fait un GET nu).
 * - Aucune redirection : cette fonction répond directement sur GET/HEAD,
 *   pas de res.redirect() ici. Les éventuelles redirections (www→apex,
 *   http→https, trailing slash) sont gérées au niveau de l'hébergeur/DNS,
 *   en amont de cette fonction — donner au monitor l'URL déjà finale.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // GET/HEAD uniquement : n'importe quelle autre méthode reste un 200 (le
  // monitor ne fait qu'un GET), mais on borne quand même à ce qui a du sens.
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
    res.setHeader('Allow', 'GET, HEAD, OPTIONS')
    return res.status(405).end()
  }

  // Pas de CORS restrictif : accepte n'importe quelle origine (ou aucune).
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    return res.status(204).end()
  }

  if (req.method === 'HEAD') {
    return res.status(200).end()
  }

  return res.status(200).send('ok')
}
