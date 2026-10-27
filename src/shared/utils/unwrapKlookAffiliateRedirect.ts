/**
 * Resolve `affiliate.klook.com/redirect?k_site=...` to the real destination URL
 * (usually `www.klook.com`) so universal links / app handoff work. Shared by
 * server affiliate tracking and client nav `href` (e.g. iOS Safari native taps).
 */
export function unwrapKlookAffiliateRedirectUrl(baseUrl: string): string {
  try {
    const u = new URL(baseUrl)
    if (u.hostname !== 'affiliate.klook.com') return baseUrl
    const kSite = u.searchParams.get('k_site')
    if (!kSite) return baseUrl
    const decoded = decodeURIComponent(kSite)
    const dest = new URL(decoded.startsWith('http') ? decoded : `https://${decoded}`)
    for (const [key, value] of u.searchParams.entries()) {
      if (key === 'k_site') continue
      if (key === 'aid' || key === 'aff_adid') {
        dest.searchParams.set(key, value)
        continue
      }
      if (!dest.searchParams.has(key)) dest.searchParams.set(key, value)
    }
    return dest.toString()
  } catch {
    return baseUrl
  }
}
