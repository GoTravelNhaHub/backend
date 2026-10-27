import { type HttpEvent, setHeader } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { popularDestinations } from '../services/trips'

// Destinations with the most public community trips
export async function destinationsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-list', 120, 60 * 1000)
  setHeader(event, 'cache-control', 'public, s-maxage=300, stale-while-revalidate=600')
  return { success: true, data: await popularDestinations() }
}
