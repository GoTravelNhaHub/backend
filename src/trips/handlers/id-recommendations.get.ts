import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'
import { recommendActivities } from '../services/trip-recommendations'
import { itineraryActivityIds, type Itinerary } from '../../planner/services/itinerary-generator'
import type { TripPartyMember } from '../../shared/types/trip'

// Activities that fit a saved trip's family and are not already in the itinerary
export async function idRecommendationsGet(event: HttpEvent) {
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id')
  const trip = id ? await prisma.trip.findFirst({ where: { id, userId: user.id } }) : null

  if (!trip) {
    throw createError({ statusCode: 404, message: 'Trip not found.' })
  }

  const party = (trip.party as unknown as TripPartyMember[]) || []
  const preferences = (trip.preferences as { interests?: string | null } | null) || null

  const data = await recommendActivities({
    destination: trip.destination,
    ages: party.map((person) => person.age),
    interests: preferences?.interests,
    excludeIds: itineraryActivityIds(trip.itinerary as unknown as Itinerary),
    limit: 6
  })

  return { success: true, data }
}
