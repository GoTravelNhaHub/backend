import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { getSessionUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { getTripForViewer } from '../services/trips'
import { resolveActivities } from '../../trips/services/trip-catalogue'
import type { PublishedItinerary } from '../../shared/types/community'

const SLUG = /^[a-z0-9-]{3,80}$/

const activityIds = (itinerary: PublishedItinerary) =>
  itinerary.days.flatMap((day) => day.items.map((item) => item.activityId)).filter((id): id is string => !!id)

// A published trip with live prices for its activities. Answers depend on who asks
// (authors see their private trips), so responses are never cached.
export async function tripsSlugGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-trip', 120, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')

  const slug = getRouterParam(event, 'slug') || ''
  if (!SLUG.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })

  const viewer = await getSessionUser(event.req).catch(() => null)
  const { view, viewerIsAuthor, sourceTripId } = await getTripForViewer(slug, viewer?.id ?? null)
  return {
    success: true,
    data: view,
    viewerIsAuthor,
    sourceTripId,
    activities: await resolveActivities(activityIds(view.itinerary))
  }
}
