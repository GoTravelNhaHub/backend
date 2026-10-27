import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { saveTrip } from '../services/social'

// Save a community trip. Idempotent: saving twice keeps one save.
export async function tripsSlugSavePut(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-save', 60, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })
  return { success: true, data: await saveTrip(user.id, slug) }
}
