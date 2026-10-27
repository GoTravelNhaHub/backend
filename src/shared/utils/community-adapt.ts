// Customize with AI: the customize form on a community trip hands its answers to /planner?adapt=<slug>
// through sessionStorage, not the URL, so a shared or crawled link never starts a paid AI call.

const KEY = 'gotravelnha_adapt_request'
const MAX_AGE_MS = 15 * 60 * 1000

export interface AdaptHandoff {
  slug: string
  tripId: string
  startDate: string
  endDate: string
  adults: number
  childAges: number[]
  budget: number | null
  interests: string
  pace: 'relaxed' | 'balanced' | 'packed' | null
  createdAt: number
}

export function writeAdaptHandoff(handoff: Omit<AdaptHandoff, 'createdAt'>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...handoff, createdAt: Date.now() }))
    return true
  } catch {
    // Private mode or storage blocked: the planner opens pre-filled from the URL instead
    return false
  }
}

const isDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)

/** Reads and removes the handoff for this trip. Anything stale, for another trip, or malformed is ignored. */
export function takeAdaptHandoff(slug: string): AdaptHandoff | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(KEY)
    sessionStorage.removeItem(KEY)
  } catch {
    return null
  }
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as Partial<AdaptHandoff>
    if (value.slug !== slug || typeof value.tripId !== 'string') return null
    if (typeof value.createdAt !== 'number' || Date.now() - value.createdAt > MAX_AGE_MS) return null
    if (!isDate(value.startDate) || !isDate(value.endDate)) return null
    const adults = Math.min(Math.max(Math.round(Number(value.adults) || 0), 1), 8)
    const childAges = (Array.isArray(value.childAges) ? value.childAges : [])
      .map((age) => Math.round(Number(age)))
      .filter((age) => Number.isFinite(age) && age >= 0 && age <= 17)
      .slice(0, 8)
    const budget = typeof value.budget === 'number' && value.budget > 0 ? Math.min(value.budget, 1_000_000) : null
    const pace = value.pace === 'relaxed' || value.pace === 'balanced' || value.pace === 'packed' ? value.pace : null
    return {
      slug,
      tripId: value.tripId,
      startDate: value.startDate,
      endDate: value.endDate,
      adults,
      childAges,
      budget,
      interests: typeof value.interests === 'string' ? value.interests.slice(0, 500) : '',
      pace,
      createdAt: value.createdAt
    }
  } catch {
    return null
  }
}
