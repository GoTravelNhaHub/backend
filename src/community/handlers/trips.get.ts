import { type HttpEvent, getQuery, setHeader } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { listPublicTrips } from '../services/trips'
import { parseCommunityFilters } from '../../shared/utils/community-filters'

// Discovery list for /community and the home page. Public trips only, so it can be cached briefly.
export async function tripsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-list', 120, 60 * 1000)
  const query = getQuery(event)
  const limit = Number(query.limit)
  const result = await listPublicTrips(parseCommunityFilters(query), {
    cursor: typeof query.cursor === 'string' ? query.cursor : undefined,
    limit: Number.isFinite(limit) ? limit : undefined
  })
  setHeader(event, 'cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
  return { success: true, ...result }
}
