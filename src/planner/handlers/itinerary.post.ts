import { type HttpEvent, createError, getRequestIP, readBody } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import { createHash } from 'crypto'
import type { Prisma } from '@prisma/client'
import prisma from '../../prisma/prisma.client'
import { getSessionUser } from '../../auth/session'
import { loadCatalogue, resolveActivities } from '../../trips/services/trip-catalogue'
import { adaptationSource } from '../../community/services/trips'
import { communityEnabled } from '../../shared/utils/feature-flags'
import {
  AdaptFromSchema,
  ITINERARY_MODEL,
  MAX_TRIP_DAYS,
  PLANNER_GUEST_DAILY_LIMIT,
  PLANNER_SITE_DAILY_LIMIT,
  PLANNER_USER_DAILY_LIMIT,
  RevisionSchema,
  TripRequestSchema,
  generateItinerary,
  itineraryActivityIds,
  tripDates,
  type Adaptation,
  type Itinerary,
  type Revision
} from '../services/itinerary-generator'

export async function itineraryPost(event: HttpEvent) {
  const body = await readBody(event)
  const parsed = TripRequestSchema.safeParse(body)
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Please check the destination, dates and travellers.' })
  }
  const request = parsed.data
  const revise = body?.revise ? RevisionSchema.safeParse(body.revise) : null
  if (revise && !revise.success) {
    throw createError({ statusCode: 400, message: 'Describe the change in a few words.' })
  }
  const adaptFrom = body?.adaptFrom && communityEnabled(useRuntimeConfig().public) ? AdaptFromSchema.safeParse(body.adaptFrom) : null
  if (adaptFrom && !adaptFrom.success) {
    throw createError({ statusCode: 400, message: 'The trip to customize was not found.' })
  }

  const today = new Date().toISOString().slice(0, 10)
  if (request.startDate < today || request.endDate < request.startDate) {
    throw createError({ statusCode: 400, message: 'Choose a start date from today and an end date after it.' })
  }
  if (tripDates(request.startDate, request.endDate).length > MAX_TRIP_DAYS) {
    throw createError({ statusCode: 400, message: `Trips can be up to ${MAX_TRIP_DAYS} days.` })
  }

  const user = await getSessionUser(event.req)
  const clientKey = user
    ? `user:${user.id}`
    : `ip:${createHash('sha256')
        .update(`${getRequestIP(event, { xForwardedFor: true }) || 'unknown'}:${useRuntimeConfig().SESSION_PASSWORD}`)
        .digest('hex')}`

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [clientCount, siteCount] = await Promise.all([
    prisma.itineraryGeneration.count({ where: { clientKey, createdAt: { gte: since } } }),
    prisma.itineraryGeneration.count({ where: { createdAt: { gte: since } } })
  ])

  if (clientCount >= (user ? PLANNER_USER_DAILY_LIMIT : PLANNER_GUEST_DAILY_LIMIT)) {
    throw createError({
      statusCode: 429,
      message: user
        ? 'You have reached today’s trip plan limit. Please try again tomorrow.'
        : 'Guests can create 3 trip plans a day. Sign in to create more.'
    })
  }
  if (siteCount >= PLANNER_SITE_DAILY_LIMIT) {
    console.warn('[itinerary] Site-wide daily limit reached')
    throw createError({ statusCode: 503, message: 'The trip planner is busy today. Please try again tomorrow.' })
  }

  let revision: Revision | undefined
  // Community trip this plan is based on: set by Customize with AI, and kept through revisions
  let sourceTripId: string | null = null
  if (revise?.success) {
    const previous = await prisma.itineraryGeneration.findUnique({ where: { id: revise.data.generationId } })
    // Same visibility rule as /api/planner/generations/[id]
    if (!previous || previous.status !== 'SUCCESS' || !previous.itinerary || (previous.userId && previous.userId !== user?.id)) {
      throw createError({ statusCode: 404, message: 'The plan to change was not found. Build a new plan instead.' })
    }
    revision = { itinerary: previous.itinerary as unknown as Itinerary, change: revise.data.change }
    sourceTripId = previous.sourceTripId
  }

  let adaptation: Adaptation | undefined
  if (adaptFrom?.success && !revision) {
    const source = await adaptationSource(adaptFrom.data.tripId)
    if (!source) throw createError({ statusCode: 404, message: 'The trip to customize was not found.' })
    adaptation = source
    sourceTripId = source.id
  }

  const catalogue = await loadCatalogue(request.destination)
  const result = await generateItinerary(request, catalogue, revision, adaptation)

  const generation = await prisma.itineraryGeneration.create({
    data: {
      userId: user?.id ?? null,
      clientKey,
      destination: request.destination,
      request,
      itinerary: result.itinerary ? (result.itinerary as unknown as Prisma.InputJsonValue) : undefined,
      model: ITINERARY_MODEL,
      status: result.status,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      sourceTripId
    }
  })

  if (!result.itinerary) {
    throw createError({
      statusCode: 502,
      message:
        result.status === 'REFUSED'
          ? 'We could not plan this trip. Try different details.'
          : 'The trip planner could not finish. Please try again.'
    })
  }

  return {
    success: true,
    generationId: generation.id,
    sourceTripId,
    request,
    itinerary: result.itinerary,
    activities: await resolveActivities(itineraryActivityIds(result.itinerary)),
    catalogueSize: catalogue.length
  }
}
