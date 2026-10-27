import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { resolveActivities } from '../../trips/services/trip-catalogue'
import { itineraryActivityIds, type Itinerary } from '../../planner/services/itinerary-generator'
import type { TripPartyMember } from '../../shared/types/trip'

// Public, read-only view of a shared trip. Only what the plan needs: no owner, no budget,
// and travellers by age only (names stay private).
export async function tripsShareIdGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'trip-share', 60, 60 * 1000)

  const shareId = getRouterParam(event, 'shareId') || ''
  if (!/^[A-Za-z0-9_-]{8,32}$/.test(shareId)) {
    throw createError({ statusCode: 404, message: 'This shared plan was not found.' })
  }

  const trip = await prisma.trip.findUnique({
    where: { shareId },
    select: { title: true, destination: true, startDate: true, endDate: true, party: true, itinerary: true }
  })
  if (!trip) {
    throw createError({ statusCode: 404, message: 'This shared plan was not found or is no longer shared.' })
  }

  const itinerary = trip.itinerary as unknown as Itinerary
  const party = ((trip.party as unknown as TripPartyMember[]) || []).map((person) => ({ age: person.age }))

  return {
    success: true,
    data: {
      title: trip.title,
      destination: trip.destination,
      startDate: trip.startDate,
      endDate: trip.endDate,
      party,
      itinerary
    },
    activities: await resolveActivities(itineraryActivityIds(itinerary))
  }
}
