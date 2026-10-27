/** Hosts a raw affiliate handoff may open. Subdomains are included. */
export const APPROVED_PARTNER_HOSTS = ['trip.com', 'klook.com', 'agoda.com', 'booking.com'] as const

export function isApprovedPartnerUrl(value: string): boolean {
  try {
    const url = new URL(value)
    const host = url.hostname.toLowerCase()
    return (
      url.protocol === 'https:' &&
      APPROVED_PARTNER_HOSTS.some((partner) => host === partner || host.endsWith(`.${partner}`))
    )
  } catch {
    return false
  }
}

/**
 * Open the tracked partner URL when the click API returns one.
 * If tracking fails, keep a partner fallback so the booking is not blocked.
 * Refuse anything else, including javascript: and unknown hosts.
 */
export function resolveHandoffUrl(tracked: string | null | undefined, fallback: string): string | null {
  if (tracked && isApprovedPartnerUrl(tracked)) return tracked
  if (isApprovedPartnerUrl(fallback)) return fallback
  if (fallback.startsWith('/') && !fallback.startsWith('//')) return fallback
  return null
}

const SENSITIVE_KEY = /email|phone|password|token|secret|address|firstname|lastname|customername/i

/** Drop contact details before a click or funnel event is stored. */
export function publicClickMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue
    if (typeof entry === 'string') {
      if (entry.includes('@') || entry.length > 200) continue
      out[key] = entry
    } else if (typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      out[key] = entry
    } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const nested = publicClickMetadata(entry)
      if (nested) out[key] = nested
    }
  }
  if (!Object.keys(out).length) return null
  if (JSON.stringify(out).length > 2000) return null
  return out
}
