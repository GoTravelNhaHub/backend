import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { followTraveler } from '../services/social'

// Follow a traveler. Idempotent; you cannot follow yourself.
export async function profilesHandleFollowPut(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-follow', 60, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const handle = (getRouterParam(event, 'handle') || '').toLowerCase()
  if (!/^[a-z0-9_]{3,30}$/.test(handle)) throw createError({ statusCode: 404, message: 'This traveler was not found.' })
  return { success: true, data: await followTraveler(user.id, handle) }
}
