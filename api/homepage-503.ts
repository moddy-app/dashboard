import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Serve the homepage HTML with a 503 status code
 * This allows health monitoring systems to detect service unavailability
 * while keeping the same visual appearance for users
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    // Read the built index.html from the app directory
    const htmlPath = join(process.cwd(), 'app', 'index.html')
    const html = readFileSync(htmlPath, 'utf-8')

    // Set the status to 503 Service Unavailable
    res.status(503)

    // Set proper headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate')
    res.setHeader('Retry-After', '3600') // Suggest retry after 1 hour

    // Return the HTML
    return res.send(html)
  } catch (error) {
    console.error('Error serving homepage:', error)
    return res.status(503).send('<html><body><h1>503 Service Unavailable</h1></body></html>')
  }
}
