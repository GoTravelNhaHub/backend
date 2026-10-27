/**
 * Public canonical origin. Never the request host: cached pages were emitting
 * http://localhost. Apex redirects to www, so www is the URL that returns 200.
 */
export function canonicalSiteOrigin(configured?: string | null) {
  const raw = String(configured || 'https://www.gotravelnha.com')
    .trim()
    .replace(/\/$/, '')

  try {
    const url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    if (url.hostname === 'gotravelnha.com') url.hostname = 'www.gotravelnha.com'
    if (url.hostname === 'www.gotravelnha.com') url.protocol = 'https:'
    return url.origin
  } catch {
    return 'https://www.gotravelnha.com'
  }
}
