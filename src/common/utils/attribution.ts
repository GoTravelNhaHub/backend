import type { Request } from 'express'

// Cookies set by plugins/attribution.client.ts. Both are optional and untrusted:
// values are clipped and only known keys are kept.

const KEYS = ['source', 'medium', 'campaign', 'term', 'content', 'gclid', 'fbclid', 'referrer', 'landingPage', 'at'] as const
type Touch = Partial<Record<(typeof KEYS)[number], string>>
export interface Attribution {
  first?: Touch
  last?: Touch
}

const cleanTouch = (value: unknown): Touch | undefined => {
  if (!value || typeof value !== 'object') return undefined
  const touch: Touch = {}
  for (const key of KEYS) {
    const field = (value as Record<string, unknown>)[key]
    if (typeof field === 'string' && field) touch[key] = field.slice(0, 200)
  }
  return Object.keys(touch).length ? touch : undefined
}

export function readAttribution(req: Request): Attribution | null {
  const raw = req.cookies?.gtn_attr as string | undefined
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    const result: Attribution = { first: cleanTouch(parsed?.first), last: cleanTouch(parsed?.last) }
    return result.first || result.last ? result : null
  } catch {
    return null
  }
}

/** Visitor session id shared with the activity tracker, for funnel joins. */
export function readVisitorSession(req: Request): string | null {
  const value = req.cookies?.gtn_sid as string | undefined
  return value && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : null
}

/** Channel used in reports: first-touch source, else "direct". */
export const channelOf = (attribution: unknown) => {
  const first = (attribution as Attribution | null)?.first
  if (!first) return 'direct'
  if (first.gclid) return 'google-ads'
  if (first.fbclid) return 'meta-ads'
  if (first.source) return [first.source, first.medium].filter(Boolean).join(' / ')
  if (first.referrer) {
    try {
      return `referral / ${new URL(first.referrer).hostname.replace(/^www\./, '')}`
    } catch {
      return 'referral'
    }
  }
  return 'direct'
}
