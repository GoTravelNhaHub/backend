import { createError } from '../../common/http-error'
import prisma from '../../prisma/prisma.client'
import type { CommunityTripCard, PublishedItinerary } from '../../shared/types/community'
import { canView } from './trips'

// Saving community trips. The save and its counter change in one transaction, and saving
// twice (two tabs, a retried request) is a no-op rather than a second count.

const notFound = () => createError({ statusCode: 404, message: 'This trip was not found.' })

/** A trip the viewer may save: anything they can see, except their own private drafts. */
async function saveableTripId(slug: string, viewerId: string) {
  const trip = await prisma.publishedTrip.findUnique({
    where: { slug },
    select: { id: true, authorId: true, visibility: true, status: true, author: { select: { status: true } } }
  })
  if (!trip || !canView(trip, viewerId) || trip.visibility === 'PRIVATE') throw notFound()
  return trip.id
}

export async function saveTrip(viewerId: string, slug: string) {
  const tripId = await saveableTripId(slug, viewerId)
  return prisma.$transaction(async (tx) => {
    const created = await tx.savedTrip.createMany({ data: [{ userId: viewerId, tripId }], skipDuplicates: true })
    const trip = created.count
      ? await tx.publishedTrip.update({ where: { id: tripId }, data: { saveCount: { increment: 1 } }, select: { saveCount: true } })
      : await tx.publishedTrip.findUniqueOrThrow({ where: { id: tripId }, select: { saveCount: true } })
    return { saved: true, saveCount: trip.saveCount }
  })
}

/** Unsaving works even if the trip has since been hidden or made private, so users can tidy their list. */
export async function unsaveTrip(viewerId: string, slug: string) {
  const trip = await prisma.publishedTrip.findUnique({ where: { slug }, select: { id: true } })
  if (!trip) throw notFound()
  return prisma.$transaction(async (tx) => {
    const removed = await tx.savedTrip.deleteMany({ where: { userId: viewerId, tripId: trip.id } })
    if (removed.count) {
      // Never below zero (also a CHECK constraint in the migration)
      await tx.publishedTrip.updateMany({ where: { id: trip.id, saveCount: { gt: 0 } }, data: { saveCount: { decrement: 1 } } })
    }
    const after = await tx.publishedTrip.findUniqueOrThrow({ where: { id: trip.id }, select: { saveCount: true } })
    return { saved: false, saveCount: after.saveCount }
  })
}

/** Which of these trip ids the viewer has saved (for bookmark state on cards). */
export async function savedState(viewerId: string, tripIds: string[]) {
  const ids = [...new Set(tripIds)].slice(0, 50)
  if (!ids.length) return []
  const rows = await prisma.savedTrip.findMany({ where: { userId: viewerId, tripId: { in: ids } }, select: { tripId: true } })
  return rows.map((row) => row.tripId)
}

const SAVED_PAGE = 24

/**
 * The viewer's saved trips, newest save first. Trips that are no longer visible
 * (made private, hidden, removed) are left out but stay saved, so they return if republished.
 */
export async function listSaved(viewerId: string, cursor?: string) {
  const before = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor) : undefined
  const rows = await prisma.savedTrip.findMany({
    where: {
      userId: viewerId,
      ...(before ? { createdAt: { lt: before } } : {}),
      trip: { status: 'ACTIVE', visibility: { not: 'PRIVATE' }, author: { status: 'ACTIVE' } }
    },
    orderBy: { createdAt: 'desc' },
    take: SAVED_PAGE + 1,
    select: {
      createdAt: true,
      trip: {
        select: {
          id: true,
          slug: true,
          title: true,
          description: true,
          destination: true,
          country: true,
          durationDays: true,
          travelStyle: true,
          budgetLevel: true,
          familyFriendly: true,
          childAgeBands: true,
          coverImage: true,
          itinerary: true,
          saveCount: true,
          commentCount: true,
          adaptCount: true,
          publishedAt: true,
          createdAt: true,
          author: { select: { handle: true, displayName: true, avatarUrl: true } }
        }
      }
    }
  })
  const page = rows.slice(0, SAVED_PAGE)
  const data: CommunityTripCard[] = page.map(({ trip }) => {
    const itinerary = trip.itinerary as unknown as PublishedItinerary
    return {
      id: trip.id,
      slug: trip.slug,
      title: trip.title,
      destination: trip.destination,
      country: trip.country,
      durationDays: trip.durationDays,
      travelStyle: trip.travelStyle,
      budgetLevel: trip.budgetLevel,
      familyFriendly: trip.familyFriendly,
      childAgeBands: trip.childAgeBands,
      coverImage: trip.coverImage,
      highlights: (itinerary?.days ?? []).map((day) => day.theme).filter(Boolean).slice(0, 3),
      description: trip.description ?? (itinerary?.summary || null),
      saveCount: trip.saveCount,
      commentCount: trip.commentCount,
      adaptCount: trip.adaptCount,
      // Unlisted trips have no publishedAt; the card shows when it was created instead
      publishedAt: (trip.publishedAt ?? trip.createdAt).toISOString(),
      author: trip.author
    }
  })
  return {
    data,
    nextCursor: rows.length > SAVED_PAGE ? page[page.length - 1].createdAt.toISOString() : null
  }
}

// ---------------------------------------------------------------------------
// Following. Follow.followerId is a User (no public profile needed to follow);
// followeeId is a TravelerProfile. Following twice is a no-op.

async function followTarget(handle: string) {
  const profile = await prisma.travelerProfile.findUnique({ where: { handle }, select: { userId: true, status: true } })
  if (!profile || profile.status !== 'ACTIVE') throw createError({ statusCode: 404, message: 'This traveler was not found.' })
  return profile.userId
}

const followerCount = (followeeId: string) => prisma.follow.count({ where: { followeeId } })

export async function followTraveler(viewerId: string, handle: string) {
  const followeeId = await followTarget(handle)
  if (followeeId === viewerId) throw createError({ statusCode: 400, message: 'You cannot follow yourself.' })
  await prisma.follow.createMany({ data: [{ followerId: viewerId, followeeId }], skipDuplicates: true })
  return { following: true, followers: await followerCount(followeeId) }
}

/** Unfollowing works even if the profile has since been suspended. */
export async function unfollowTraveler(viewerId: string, handle: string) {
  const profile = await prisma.travelerProfile.findUnique({ where: { handle }, select: { userId: true } })
  if (!profile) throw createError({ statusCode: 404, message: 'This traveler was not found.' })
  await prisma.follow.deleteMany({ where: { followerId: viewerId, followeeId: profile.userId } })
  return { following: false, followers: await followerCount(profile.userId) }
}

/** Which of these handles the viewer follows (for Follow buttons). */
export async function followState(viewerId: string, handles: string[]) {
  const list = [...new Set(handles)].slice(0, 50)
  if (!list.length) return []
  const rows = await prisma.follow.findMany({
    where: { followerId: viewerId, followee: { handle: { in: list } } },
    select: { followee: { select: { handle: true } } }
  })
  return rows.map((row) => row.followee.handle)
}
