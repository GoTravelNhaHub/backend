import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'
import { resolveActivities } from '../services/trip-catalogue'
import { itineraryActivityIds, type Itinerary } from '../../planner/services/itinerary-generator'

export async function idGet(event: HttpEvent) {
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id')
  const trip = id
    ? await prisma.trip.findFirst({
        where: { id, userId: user.id },
        // Community version of this trip, if the owner published it
        include: { published: { select: { id: true, slug: true, visibility: true, status: true } } }
      })
    : null

  if (!trip) {
    throw createError({ statusCode: 404, message: 'Trip not found.' })
  }

  const itinerary = trip.itinerary as unknown as Itinerary
  return {
    success: true,
    data: trip,
    // Prices and availability as of now, not as of when the trip was planned
    activities: await resolveActivities(itineraryActivityIds(itinerary))
  }
}
