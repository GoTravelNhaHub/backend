import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { getSessionUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { getTripForViewer } from '../services/trips'
import { getTripMap } from '../services/trip-map'

const SLUG = /^[a-z0-9-]{3,80}$/

// Map pins for a trip's stops. The first request for a trip version names and geocodes the
// places (a few seconds per stop, OpenStreetMap allows one lookup a second); later ones read the cache.
export async function tripsSlugMapGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-trip-map', 20, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')

  const slug = getRouterParam(event, 'slug') || ''
  if (!SLUG.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })

  // Authors can map their private trips too
  const viewer = await getSessionUser(event.req).catch(() => null)
  const { view } = await getTripForViewer(slug, viewer?.id ?? null)
  return { success: true, data: await getTripMap(view) }
}
