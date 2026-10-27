import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { getTripForViewer } from '../services/trips'
import { recommendActivities } from '../../trips/services/trip-recommendations'
import { CHILD_AGE_BANDS } from '../../shared/types/community'

// Bookable activities for a published trip's destination, with live supplier prices.
// Only listed, verified offers; never prices from the plan text.
const BAND_AGES: Record<string, number> = { '0-2': 1, '3-5': 4, '6-12': 8, '13-17': 14 }

export async function tripsSlugBookingOptionsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-booking', 60, 60 * 1000)
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })

  // Public and unlisted trips only: no session, so a private trip is never looked up here
  const { view } = await getTripForViewer(slug, null)
  const excludeIds = view.itinerary.days.flatMap((day) => day.items.map((item) => item.activityId)).filter((id): id is string => !!id)
  const ages = view.childAgeBands.filter((band) => (CHILD_AGE_BANDS as readonly string[]).includes(band)).map((band) => BAND_AGES[band])

  const data = await recommendActivities({ destination: view.destination, ages, interests: null, excludeIds, limit: 6 })
  return { success: true, data }
}
