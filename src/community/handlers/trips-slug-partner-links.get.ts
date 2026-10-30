import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { getTripForViewer } from '../services/trips'
import { resolveActivities } from '../../trips/services/trip-catalogue'
import { daySuggestions } from '../../shared/utils/community-booking'
import { findStopMatch, type ProviderMatch, type StopInput } from '../../affiliate/services/partner-link-resolver'

const SLUG = /^[a-z0-9-]{3,80}$/
const CONCURRENCY = 4
// Answer before the function limit; lookups still running finish into the cache for the next visitor
const TIME_BUDGET_MS = 75_000

// For each stop a trip page would send to a Klook search: a partner product page, a better Klook
// search keyword, or neither (nothing to book). Keyed by the search query the page builds (utils/community-booking.ts).
export async function tripsSlugPartnerLinksGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-partner-links', 10, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')

  const slug = getRouterParam(event, 'slug') || ''
  if (!SLUG.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })

  // Public and unlisted trips only, as for booking suggestions
  const { view } = await getTripForViewer(slug, null)
  const ids = view.itinerary.days.flatMap((day) => day.items.map((item) => item.activityId)).filter((id): id is string => !!id)
  const activities = await resolveActivities(ids)
  // One lookup per search query; the full stop title goes along as context
  const stops = new Map<string, StopInput>()
  for (const day of daySuggestions(view.itinerary.days, activities, view.destination)) {
    for (const entry of day.activities) if (entry.kind === 'search' && !stops.has(entry.query)) stops.set(entry.query, { query: entry.query, title: entry.label })
  }
  const queries = [...stops.values()]
  const city = view.destination.split(',')[0].trim()

  const links: Record<string, ProviderMatch> = {}
  let next = 0
  const worker = async () => {
    while (next < queries.length) {
      const stop = queries[next++]
      const match = await findStopMatch(stop, city)
      if (match) links[stop.query] = match
    }
  }
  const all = Promise.all(Array.from({ length: Math.min(CONCURRENCY, queries.length) }, worker))
  let timer: NodeJS.Timeout | undefined
  await Promise.race([all, new Promise((resolve) => (timer = setTimeout(resolve, TIME_BUDGET_MS)))])
  clearTimeout(timer)

  return { success: true, data: links, pending: queries.some((stop) => !(stop.query in links)) }
}
