import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { unsaveTrip } from '../services/social'

// Remove a saved trip. Removing one that was not saved is a no-op.
export async function tripsSlugSaveDelete(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-save', 60, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })
  return { success: true, data: await unsaveTrip(user.id, slug) }
}
