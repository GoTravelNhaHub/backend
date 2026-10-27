import { type HttpEvent, createError, readBody } from '../../common/http'
import type { Prisma } from '@prisma/client'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'
import type { Itinerary, TripRequest } from '../../planner/services/itinerary-generator'

// Saves a generated itinerary to the signed-in user's trips. Takes the generation id,
// not itinerary JSON, so the saved plan is exactly what the planner produced.
export async function tripsPost(event: HttpEvent) {
  const user = await requireUser(event.req)
  const body = await readBody(event)
  const generationId = typeof body?.generationId === 'string' ? body.generationId : null

  const generation = generationId
    ? await prisma.itineraryGeneration.findUnique({ where: { id: generationId } })
    : null

  if (
    !generation ||
    generation.status !== 'SUCCESS' ||
    !generation.itinerary ||
    (generation.userId && generation.userId !== user.id)
  ) {
    throw createError({ statusCode: 404, message: 'Trip plan not found.' })
  }

  const existing = await prisma.trip.findUnique({ where: { generationId: generation.id } })
  if (existing) {
    if (existing.userId !== user.id) {
      throw createError({ statusCode: 409, message: 'This trip plan has already been saved.' })
    }
    return { success: true, data: { id: existing.id } }
  }

  const request = generation.request as unknown as TripRequest
  const itinerary = generation.itinerary as unknown as Itinerary
  const title =
    typeof body?.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 120) : itinerary.title

  // Customized from a community trip: keep the link for attribution and count the adaptation
  // once, when the adapted plan is first saved. The original trip is otherwise never changed.
  const sourceTripId = generation.sourceTripId
    ? (await prisma.publishedTrip.findUnique({ where: { id: generation.sourceTripId }, select: { id: true } }))?.id ?? null
    : null

  // Checked non-null above; the transaction callback does not keep that narrowing
  const savedItinerary = generation.itinerary as Prisma.InputJsonValue
  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.trip.create({
      data: {
        userId: user.id,
        generationId: generation.id,
        title,
        destination: request.destination,
        startDate: new Date(`${request.startDate}T00:00:00Z`),
        endDate: new Date(`${request.endDate}T00:00:00Z`),
        budget: request.budget ?? null,
        currency: request.currency,
        party: request.party,
        preferences: { pace: request.pace, interests: request.interests ?? null },
        itinerary: savedItinerary,
        adaptedFromId: sourceTripId
      }
    })
    if (sourceTripId) {
      await tx.publishedTrip.update({ where: { id: sourceTripId }, data: { adaptCount: { increment: 1 } } })
    }
    return created
  })

  return { success: true, data: { id: trip.id } }
}
