import { createError } from '../../common/http-error'
import prisma from '../../prisma/prisma.client'
import type { CommunityTripCard, PublishedItinerary } from '../../shared/types/community'

// Public traveler profiles (/travelers/[handle]). Only the fields the person chose to make
// public: handle, display name, bio, avatar. Never email, login username or real name.

export interface TravelerView {
  handle: string
  displayName: string
  bio: string | null
  avatarUrl: string | null
  joinedAt: string
  counts: { trips: number; followers: number; following: number }
}

const PUBLIC_TRIP = { visibility: 'PUBLIC', status: 'ACTIVE', publishedAt: { not: null } } as const
const PAGE = 12

export async function getTraveler(handle: string): Promise<TravelerView> {
  const profile = await prisma.travelerProfile.findUnique({
    where: { handle },
    select: {
      userId: true,
      handle: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
      _count: { select: { trips: { where: PUBLIC_TRIP }, followers: true } }
    }
  })
  // Suspended profiles look the same as missing ones
  if (!profile || profile.status !== 'ACTIVE') throw createError({ statusCode: 404, message: 'This traveler was not found.' })
  const following = await prisma.follow.count({ where: { followerId: profile.userId, followee: { status: 'ACTIVE' } } })
  return {
    handle: profile.handle,
    displayName: profile.displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    joinedAt: profile.createdAt.toISOString(),
    counts: { trips: profile._count.trips, followers: profile._count.followers, following }
  }
}

/** A traveler's public trips, newest first. Cursor: the last trip's publishedAt. */
export async function listTravelerTrips(handle: string, cursor?: string) {
  const before = cursor && !Number.isNaN(Date.parse(cursor)) ? new Date(cursor) : undefined
  const rows = await prisma.publishedTrip.findMany({
    where: {
      ...PUBLIC_TRIP,
      author: { handle, status: 'ACTIVE' },
      ...(before ? { publishedAt: { lt: before } } : {})
    },
    orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    take: PAGE + 1,
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
      author: { select: { handle: true, displayName: true, avatarUrl: true } }
    }
  })
  const page = rows.slice(0, PAGE)
  const data: CommunityTripCard[] = page.map((trip) => {
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
      publishedAt: trip.publishedAt!.toISOString(),
      author: trip.author
    }
  })
  return { data, nextCursor: rows.length > PAGE ? page[page.length - 1].publishedAt!.toISOString() : null }
}

/** Profiles with at least one public trip, for the sitemap */
export const listIndexableTravelers = () =>
  prisma.travelerProfile.findMany({
    where: { status: 'ACTIVE', trips: { some: PUBLIC_TRIP } },
    select: { handle: true, updatedAt: true },
    take: 5000
  })
