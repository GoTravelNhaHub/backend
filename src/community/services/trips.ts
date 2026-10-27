import { createError } from '../../common/http-error'
import { Prisma } from '@prisma/client'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'
import type { Itinerary } from '../../shared/types/trip'
import {
  BUDGET_LEVELS,
  TRAVEL_STYLES,
  type CommunityCreator,
  type CommunityDestination,
  type CommunityTripCard,
  type OwnPublication,
  type PublishDraft,
  type PublishRemovals,
  type PublishedItinerary,
  type PublishedTripView
} from '../../shared/types/community'
import { buildPublishDraft, clip, MAX_TIPS, type PlanLanguage } from './sanitize'
import { publishedTripSlug } from './slug'
import { DESTINATIONS } from '../../shared/utils/destination-catalog'
import { cityOf } from '../../shared/utils/destination-slug'
import { destinationPhoto } from '../../shared/utils/destination-photos'
import { DURATION_BUCKETS, TRENDING_DAYS, type CommunityFilters } from '../../shared/utils/community-filters'

// Publishing a private Trip as a sanitized PublishedTrip, and the rules for who may read one.
// Ownership is part of every query's where clause, so another user's id finds nothing (404).

interface Viewer {
  id: string
  firstName?: string | null
  lastName?: string | null
}

const OWN_PUBLICATION_SELECT = {
  id: true,
  slug: true,
  visibility: true,
  status: true,
  title: true,
  description: true,
  travelStyle: true,
  budgetLevel: true,
  travelMonth: true,
  childAgeBands: true,
  tips: true
} as const

const notFound = () => createError({ statusCode: 404, message: 'Trip not found.' })

const countryOf = (destination: string) => {
  const city = cityOf(destination).toLowerCase()
  return DESTINATIONS.find((item) => item.name.toLowerCase() === city)?.country ?? null
}

const planLanguage = (request: unknown): PlanLanguage => {
  const language = (request as { language?: string } | null)?.language
  return language === 'vi' || language === 'zh' ? language : 'en'
}

const dateOnly = (value: Date) => value.toISOString().slice(0, 10)

/** One of the viewer's own trips with the language its plan was written in. */
async function loadOwnTrip(viewer: Viewer, tripId: string) {
  const trip = await prisma.trip.findFirst({
    where: { id: tripId, userId: viewer.id },
    include: { published: { select: OWN_PUBLICATION_SELECT } }
  })
  if (!trip) throw notFound()
  const generation = trip.generationId
    ? await prisma.itineraryGeneration.findUnique({ where: { id: trip.generationId }, select: { request: true } })
    : null
  return { trip, language: planLanguage(generation?.request) }
}

function draftFor(viewer: Viewer, loaded: Awaited<ReturnType<typeof loadOwnTrip>>, alsoReplace: string[]) {
  const { trip, language } = loaded
  return buildPublishDraft({
    title: trip.title,
    destination: trip.destination,
    country: countryOf(trip.destination),
    startDate: dateOnly(trip.startDate),
    party: (trip.party as unknown as Array<{ name?: string; age: number }>) || [],
    // The owner's own name, so "Planned by Tuan" does not go public either
    extraNames: [viewer.firstName, viewer.lastName].filter((name): name is string => !!name),
    pace: (trip.preferences as { pace?: string } | null)?.pace ?? null,
    itinerary: trip.itinerary as unknown as Itinerary,
    language,
    coverImage: destinationPhoto(trip.destination, 1600),
    alsoReplace
  })
}

export interface PublishPreview {
  draft: PublishDraft
  removals: PublishRemovals
  publication: OwnPublication | null
}

/** What publishing would show. Saves nothing. */
export async function previewPublication(viewer: Viewer, tripId: string, alsoReplace: string[] = []): Promise<PublishPreview> {
  const loaded = await loadOwnTrip(viewer, tripId)
  const { draft, removals } = draftFor(viewer, loaded, alsoReplace)
  return { draft, removals, publication: loaded.trip.published }
}

export const PublishInputSchema = z
  .object({
    tripId: z.string().uuid(),
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().max(1000).optional(),
    tips: z.array(z.string().trim().max(300)).max(MAX_TIPS).optional(),
    travelStyle: z.enum(TRAVEL_STYLES).nullable().optional(),
    budgetLevel: z.enum(BUDGET_LEVELS).nullable().optional(),
    showTravelMonth: z.boolean().default(false),
    showChildAges: z.boolean().default(false),
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']).default('PRIVATE'),
    // Required for PUBLIC: the author confirmed that anyone, including search engines, can see it
    confirmPublic: z.boolean().default(false),
    alsoReplace: z.array(z.string().trim().max(40)).max(10).default([])
  })
  .refine((input) => input.visibility !== 'PUBLIC' || input.confirmPublic, {
    message: 'Confirm that the trip can be public.',
    path: ['confirmPublic']
  })
export type PublishInput = z.infer<typeof PublishInputSchema>

/** Publishes a trip, or republishes it from the current private trip. Visibility defaults to private. */
export async function publishTrip(viewer: Viewer, input: PublishInput) {
  const profile = await prisma.travelerProfile.findUnique({ where: { userId: viewer.id }, select: { status: true } })
  if (!profile) throw createError({ statusCode: 409, message: 'Create your traveler profile first.' })
  if (profile.status !== 'ACTIVE') throw createError({ statusCode: 403, message: 'This profile has been suspended.' })

  const loaded = await loadOwnTrip(viewer, input.tripId)
  const existing = loaded.trip.published
  if (existing?.status === 'REMOVED') {
    throw createError({ statusCode: 403, message: 'This trip was removed from the community and cannot be published again.' })
  }

  // The author's own text goes through the same scrubber as the plan
  const { draft, scrub } = draftFor(viewer, loaded, input.alsoReplace)
  const title = clip(scrub(input.title), 120) || draft.title
  const description = input.description === undefined ? draft.description : clip(scrub(input.description), 1000)
  const tips = (input.tips ?? draft.tips).map((tip) => clip(scrub(tip), 300)).filter(Boolean).slice(0, MAX_TIPS)
  const itinerary: PublishedItinerary = { ...draft.itinerary, tips }

  const data = {
    visibility: input.visibility,
    title,
    description: description || null,
    destination: draft.destination,
    country: draft.country,
    durationDays: draft.durationDays,
    travelMonth: input.showTravelMonth ? draft.travelMonth : null,
    travelStyle: input.travelStyle === undefined ? draft.travelStyle : input.travelStyle,
    budgetLevel: input.budgetLevel ?? null,
    familyFriendly: draft.familyFriendly,
    childAgeBands: input.showChildAges ? draft.childAgeBands : [],
    itinerary: itinerary as unknown as Prisma.InputJsonValue,
    tips,
    coverImage: draft.coverImage
  }

  if (existing) {
    const current = await prisma.publishedTrip.findUnique({ where: { id: existing.id }, select: { publishedAt: true } })
    return prisma.publishedTrip.update({
      where: { id: existing.id },
      data: { ...data, publishedAt: current?.publishedAt ?? (input.visibility === 'PUBLIC' ? new Date() : null) },
      select: OWN_PUBLICATION_SELECT
    })
  }

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.publishedTrip.create({
        data: {
          ...data,
          slug: publishedTripSlug(title, draft.destination, draft.durationDays),
          authorId: viewer.id,
          sourceTripId: loaded.trip.id,
          publishedAt: input.visibility === 'PUBLIC' ? new Date() : null
        },
        select: OWN_PUBLICATION_SELECT
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const target = String((error.meta as { target?: unknown } | undefined)?.target ?? '')
      // Published twice at once from two tabs: the other request won, so return its row
      if (target.includes('sourceTripId')) {
        const winner = await prisma.publishedTrip.findUnique({ where: { sourceTripId: loaded.trip.id }, select: OWN_PUBLICATION_SELECT })
        if (winner) return winner
      }
      // Random slug suffix collided; try a new one
      if (attempt >= 2) throw error
    }
  }
}

export const VisibilityInputSchema = z
  .object({
    visibility: z.enum(['PRIVATE', 'UNLISTED', 'PUBLIC']),
    confirmPublic: z.boolean().default(false)
  })
  .refine((input) => input.visibility !== 'PUBLIC' || input.confirmPublic, {
    message: 'Confirm that the trip can be public.',
    path: ['confirmPublic']
  })

export async function setVisibility(viewer: Viewer, id: string, input: z.infer<typeof VisibilityInputSchema>) {
  const trip = await prisma.publishedTrip.findFirst({
    where: { id, authorId: viewer.id, status: { not: 'REMOVED' } },
    select: { id: true, publishedAt: true }
  })
  if (!trip) throw notFound()
  return prisma.publishedTrip.update({
    where: { id: trip.id },
    data: {
      visibility: input.visibility,
      publishedAt: trip.publishedAt ?? (input.visibility === 'PUBLIC' ? new Date() : null)
    },
    select: OWN_PUBLICATION_SELECT
  })
}

/** Removes the author's published version. The private trip is not touched. */
export async function deletePublication(viewer: Viewer, id: string) {
  const result = await prisma.publishedTrip.deleteMany({ where: { id, authorId: viewer.id } })
  if (result.count === 0) throw notFound()
}

// Public, active trips by active authors: discovery, sitemap and public counts
const PUBLIC_WHERE = {
  visibility: 'PUBLIC',
  status: 'ACTIVE',
  publishedAt: { not: null },
  author: { status: 'ACTIVE' }
} satisfies Prisma.PublishedTripWhereInput

const VIEW_SELECT = {
  id: true,
  slug: true,
  authorId: true,
  sourceTripId: true,
  visibility: true,
  status: true,
  title: true,
  description: true,
  destination: true,
  country: true,
  durationDays: true,
  travelMonth: true,
  travelStyle: true,
  budgetLevel: true,
  familyFriendly: true,
  childAgeBands: true,
  itinerary: true,
  coverImage: true,
  saveCount: true,
  commentCount: true,
  adaptCount: true,
  publishedAt: true,
  updatedAt: true,
  author: {
    select: {
      handle: true,
      displayName: true,
      avatarUrl: true,
      status: true,
      // Shown on the trip page: real counts only
      _count: { select: { trips: { where: PUBLIC_WHERE }, followers: true } }
    }
  }
} as const

/** Public and unlisted trips for anyone; private or moderated ones only for their author. */
export function canView(
  trip: { authorId: string; visibility: string; status: string; author: { status: string } },
  viewerId: string | null
) {
  if (trip.status === 'REMOVED') return false
  if (viewerId && trip.authorId === viewerId) return true
  return trip.status === 'ACTIVE' && trip.author.status === 'ACTIVE' && trip.visibility !== 'PRIVATE'
}

export async function getTripForViewer(slug: string, viewerId: string | null) {
  const trip = await prisma.publishedTrip.findUnique({ where: { slug }, select: VIEW_SELECT })
  if (!trip || !canView(trip, viewerId)) throw createError({ statusCode: 404, message: 'This trip was not found.' })

  const view: PublishedTripView = {
    id: trip.id,
    slug: trip.slug,
    visibility: trip.visibility,
    status: trip.status,
    title: trip.title,
    description: trip.description,
    destination: trip.destination,
    country: trip.country,
    durationDays: trip.durationDays,
    travelMonth: trip.travelMonth,
    travelStyle: trip.travelStyle,
    budgetLevel: trip.budgetLevel,
    familyFriendly: trip.familyFriendly,
    childAgeBands: trip.childAgeBands,
    itinerary: trip.itinerary as unknown as PublishedItinerary,
    coverImage: trip.coverImage,
    saveCount: trip.saveCount,
    commentCount: trip.commentCount,
    adaptCount: trip.adaptCount,
    publishedAt: trip.publishedAt?.toISOString() ?? null,
    updatedAt: trip.updatedAt.toISOString(),
    author: { handle: trip.author.handle, displayName: trip.author.displayName, avatarUrl: trip.author.avatarUrl },
    authorStats: { publicTrips: trip.author._count.trips, followers: trip.author._count.followers }
  }
  const viewerIsAuthor = !!viewerId && trip.authorId === viewerId
  // Which private trip it came from is the author's business only
  return { view, viewerIsAuthor, sourceTripId: viewerIsAuthor ? trip.sourceTripId : null }
}

/**
 * A published plan to adapt with AI: public or unlisted, active, by an active author.
 * The planner reads it as reference material; the trip itself is never changed here.
 */
export async function adaptationSource(tripId: string) {
  const trip = await prisma.publishedTrip.findFirst({
    where: { id: tripId, visibility: { in: ['PUBLIC', 'UNLISTED'] }, status: 'ACTIVE', author: { status: 'ACTIVE' } },
    select: { id: true, title: true, durationDays: true, itinerary: true }
  })
  if (!trip) return null
  const itinerary = trip.itinerary as unknown as PublishedItinerary
  return {
    id: trip.id,
    title: trip.title,
    durationDays: trip.durationDays,
    itinerary: { summary: itinerary.summary, days: itinerary.days, tips: itinerary.tips }
  }
}

/** Public trips for the sitemap */
export const listIndexableTrips = () =>
  prisma.publishedTrip.findMany({
    where: { visibility: 'PUBLIC', status: 'ACTIVE', author: { status: 'ACTIVE' } },
    select: { slug: true, updatedAt: true },
    orderBy: { publishedAt: 'desc' },
    take: 5000
  })

// ---------------------------------------------------------------------------
// Discovery: public, active trips by active authors only


const CARD_SELECT = {
  id: true,
  slug: true,
  title: true,
  destination: true,
  country: true,
  durationDays: true,
  travelStyle: true,
  budgetLevel: true,
  familyFriendly: true,
  childAgeBands: true,
  coverImage: true,
  itinerary: true,
  description: true,
  saveCount: true,
  commentCount: true,
  adaptCount: true,
  publishedAt: true,
  author: { select: { handle: true, displayName: true, avatarUrl: true } }
} as const

// Keyset cursor: the sort values of the last card shown. Opaque to clients.
interface Cursor {
  s: number
  p: string
  id: string
}

const encodeCursor = (cursor: Cursor) => Buffer.from(JSON.stringify(cursor)).toString('base64url')

function decodeCursor(value: string | undefined): Cursor | null {
  if (!value || value.length > 300) return null
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof cursor?.s !== 'number' || typeof cursor?.p !== 'string' || typeof cursor?.id !== 'string') return null
    if (Number.isNaN(new Date(cursor.p).getTime())) return null
    return cursor
  } catch {
    return null
  }
}

export const MAX_PAGE_SIZE = 24

export async function listPublicTrips(filters: CommunityFilters, options: { cursor?: string; limit?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 12, 1), MAX_PAGE_SIZE)
  const where: Prisma.PublishedTripWhereInput[] = [PUBLIC_WHERE]

  if (filters.q) {
    where.push({
      OR: [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { destination: { contains: filters.q, mode: 'insensitive' } },
        { country: { contains: filters.q, mode: 'insensitive' } }
      ]
    })
  }
  if (filters.destination) where.push({ destination: { equals: filters.destination, mode: 'insensitive' } })
  if (filters.country) where.push({ country: { equals: filters.country, mode: 'insensitive' } })
  if (filters.duration) {
    const { min, max } = DURATION_BUCKETS[filters.duration]
    where.push({ durationDays: max ? { gte: min, lte: max } : { gte: min } })
  }
  if (filters.budget) where.push({ budgetLevel: filters.budget })
  if (filters.style) where.push({ travelStyle: filters.style })
  if (filters.family) where.push({ familyFriendly: true })

  if (filters.sort === 'trending') {
    where.push({ publishedAt: { gte: new Date(Date.now() - TRENDING_DAYS * 24 * 60 * 60 * 1000) } })
  }

  const cursor = decodeCursor(options.cursor)
  const bySaves = filters.sort === 'saved' || filters.sort === 'trending'
  if (cursor) {
    const p = new Date(cursor.p)
    const olderThanCursor: Prisma.PublishedTripWhereInput = {
      OR: [{ publishedAt: { lt: p } }, { publishedAt: p, id: { lt: cursor.id } }]
    }
    where.push(
      bySaves
        ? { OR: [{ saveCount: { lt: cursor.s } }, { saveCount: cursor.s, ...olderThanCursor }] }
        : olderThanCursor
    )
  }

  const rows = await prisma.publishedTrip.findMany({
    where: { AND: where },
    orderBy: bySaves
      ? [{ saveCount: 'desc' }, { publishedAt: 'desc' }, { id: 'desc' }]
      : [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: CARD_SELECT
  })

  const page = rows.slice(0, limit)
  const last = page[page.length - 1]
  const cards: CommunityTripCard[] = page.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    destination: row.destination,
    country: row.country,
    durationDays: row.durationDays,
    travelStyle: row.travelStyle,
    budgetLevel: row.budgetLevel,
    familyFriendly: row.familyFriendly,
    childAgeBands: row.childAgeBands,
    coverImage: row.coverImage,
    highlights: ((row.itinerary as unknown as PublishedItinerary)?.days ?? []).map((day) => day.theme).filter(Boolean).slice(0, 3),
    description: row.description ?? ((row.itinerary as unknown as PublishedItinerary)?.summary || null),
    saveCount: row.saveCount,
    commentCount: row.commentCount,
    adaptCount: row.adaptCount,
    publishedAt: row.publishedAt!.toISOString(),
    author: row.author
  }))

  return {
    data: cards,
    nextCursor: rows.length > limit && last ? encodeCursor({ s: last.saveCount, p: last.publishedAt!.toISOString(), id: last.id }) : null
  }
}

/** Destinations with the most public trips */
export async function popularDestinations(limit = 12): Promise<CommunityDestination[]> {
  const groups = await prisma.publishedTrip.groupBy({
    by: ['destination', 'country'],
    where: PUBLIC_WHERE,
    _count: { _all: true },
    orderBy: { _count: { destination: 'desc' } },
    take: limit
  })
  return groups.map((group) => ({ destination: group.destination, country: group.country, count: group._count._all }))
}

/** Active creators with the most public trips; follower counts are real Follow rows */
export async function topCreators(limit = 3): Promise<CommunityCreator[]> {
  const profiles = await prisma.travelerProfile.findMany({
    where: { status: 'ACTIVE', trips: { some: PUBLIC_WHERE } },
    select: {
      handle: true,
      displayName: true,
      avatarUrl: true,
      _count: { select: { trips: { where: PUBLIC_WHERE }, followers: true } }
    },
    orderBy: [{ followers: { _count: 'desc' } }, { trips: { _count: 'desc' } }],
    take: limit
  })
  return profiles.map((profile) => ({
    handle: profile.handle,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    tripCount: profile._count.trips,
    followerCount: profile._count.followers
  }))
}
