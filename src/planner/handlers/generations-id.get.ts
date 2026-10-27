import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { getSessionUser } from '../../auth/session'
import { resolveActivities } from '../../trips/services/trip-catalogue'
import { itineraryActivityIds, type Itinerary } from '../services/itinerary-generator'

// Reloads a generated itinerary (e.g. after a guest signs in) with live prices
export async function generationsIdGet(event: HttpEvent) {
  const id = getRouterParam(event, 'id')
  const generation = id ? await prisma.itineraryGeneration.findUnique({ where: { id } }) : null

  if (!generation || generation.status !== 'SUCCESS' || !generation.itinerary) {
    throw createError({ statusCode: 404, message: 'Trip plan not found.' })
  }

  // A plan made while signed in stays private to that user; guest plans are reachable by id
  if (generation.userId) {
    const user = await getSessionUser(event.req)
    if (user?.id !== generation.userId) {
      throw createError({ statusCode: 404, message: 'Trip plan not found.' })
    }
  }

  const itinerary = generation.itinerary as unknown as Itinerary
  return {
    success: true,
    generationId: generation.id,
    request: generation.request,
    itinerary,
    activities: await resolveActivities(itineraryActivityIds(itinerary))
  }
}
