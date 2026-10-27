import { type HttpEvent, createError, getQuery, getRouterParam, setHeader } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { listTravelerTrips } from '../services/travelers'

// More public trips by a traveler (cursor pagination)
export async function profilesHandleTripsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-profile-read', 120, 60 * 1000)
  const handle = (getRouterParam(event, 'handle') || '').toLowerCase()
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) throw createError({ statusCode: 404, message: 'This traveler was not found.' })
  const cursor = getQuery(event).cursor
  setHeader(event, 'cache-control', 'public, s-maxage=60, stale-while-revalidate=300')
  return { success: true, ...(await listTravelerTrips(handle, typeof cursor === 'string' ? cursor : undefined)) }
}
