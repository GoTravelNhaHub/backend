// Discovery filters for /community, read from the URL by the page and the API alike

export type DurationBucket = 'short' | 'medium' | 'long'
export type CommunitySort = 'recent' | 'saved' | 'trending'

/** Trending: most saved among trips published in this many days */
export const TRENDING_DAYS = 30

export const DURATION_BUCKETS: Record<DurationBucket, { min: number; max: number | null }> = {
  short: { min: 1, max: 3 },
  medium: { min: 4, max: 6 },
  long: { min: 7, max: null }
}

const BUDGETS = ['budget', 'mid', 'premium'] as const
const STYLES = ['relaxed', 'balanced', 'packed'] as const

export interface CommunityFilters {
  q?: string
  destination?: string
  country?: string
  duration?: DurationBucket
  budget?: (typeof BUDGETS)[number]
  style?: (typeof STYLES)[number]
  family?: boolean
  sort: CommunitySort
}

const text = (value: unknown, max: number) => {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string') return undefined
  const clean = raw.replace(/\s+/g, ' ').trim().slice(0, max)
  return clean || undefined
}

const oneOf = <T extends string>(value: unknown, options: readonly T[]) => {
  const raw = text(value, 20)
  return raw && (options as readonly string[]).includes(raw) ? (raw as T) : undefined
}

/** Unknown or malformed values are dropped, never rejected, so a shared URL always works. */
export function parseCommunityFilters(query: Record<string, unknown>): CommunityFilters {
  return {
    q: text(query.q, 80),
    destination: text(query.destination, 80),
    country: text(query.country, 60),
    duration: oneOf(query.duration, ['short', 'medium', 'long'] as const),
    budget: oneOf(query.budget, BUDGETS),
    style: oneOf(query.style, STYLES),
    family: text(query.family, 5) === '1' || text(query.family, 5) === 'true' ? true : undefined,
    sort: oneOf(query.sort, ['recent', 'saved', 'trending'] as const) ?? 'recent'
  }
}

/** True when the visitor narrowed the list (sort alone does not count). */
export const hasActiveFilters = (filters: CommunityFilters) =>
  !!(filters.q || filters.destination || filters.country || filters.duration || filters.budget || filters.style || filters.family)

/** Query string values for the filters that are set. */
export function filtersToQuery(filters: Partial<CommunityFilters>) {
  const query: Record<string, string> = {}
  for (const key of ['q', 'destination', 'country', 'duration', 'budget', 'style'] as const) {
    const value = filters[key]
    if (value) query[key] = value
  }
  if (filters.family) query.family = '1'
  if (filters.sort && filters.sort !== 'recent') query.sort = filters.sort
  return query
}
