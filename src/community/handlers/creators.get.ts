import { type HttpEvent, setHeader } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { topCreators } from '../services/trips'

// Creators with the most followers and public trips, for the /community sidebar
export async function creatorsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-list', 120, 60 * 1000)
  setHeader(event, 'cache-control', 'public, s-maxage=300, stale-while-revalidate=600')
  return { success: true, data: await topCreators() }
}
