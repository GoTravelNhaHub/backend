// Shared between the community API and pages
import type { ItineraryItem } from './trip'

export type TripVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC'
export type ContentStatus = 'ACTIVE' | 'HIDDEN' | 'REMOVED'
export type TravelStyle = 'relaxed' | 'balanced' | 'packed'
export type BudgetLevel = 'budget' | 'mid' | 'premium'

export const TRAVEL_STYLES: TravelStyle[] = ['relaxed', 'balanced', 'packed']
export const BUDGET_LEVELS: BudgetLevel[] = ['budget', 'mid', 'premium']
export const CHILD_AGE_BANDS = ['0-2', '3-5', '6-12', '13-17'] as const
export type ChildAgeBand = (typeof CHILD_AGE_BANDS)[number]

/** A published day: no date, only its position (Day 1..N). */
export interface PublishedDay {
  theme: string
  items: ItineraryItem[]
}

export interface PublishedItinerary {
  title: string
  summary: string
  days: PublishedDay[]
  tips: string[]
}

/** What publishing a trip would make public, before the author confirms. */
export interface PublishDraft {
  title: string
  description: string
  destination: string
  country: string | null
  durationDays: number
  /** Month of travel, shown only when the author opts in */
  travelMonth: number
  travelStyle: TravelStyle | null
  familyFriendly: boolean
  /** Shown only when the author opts in */
  childAgeBands: ChildAgeBand[]
  itinerary: PublishedItinerary
  tips: string[]
  coverImage: string | null
}

/** What the sanitizer took out, so the author can see it */
export interface PublishRemovals {
  /** Names replaced in the text */
  names: string[]
  /** Names too short to replace safely (they match ordinary words); the author decides */
  shortNames: string[]
  emailsOrPhones: number
}

export interface CommunityAuthor {
  handle: string
  displayName: string
  avatarUrl: string | null
}

/** A published trip as anyone allowed to see it gets it */
export interface PublishedTripView {
  id: string
  slug: string
  visibility: TripVisibility
  status: ContentStatus
  title: string
  description: string | null
  destination: string
  country: string | null
  durationDays: number
  travelMonth: number | null
  travelStyle: string | null
  budgetLevel: string | null
  familyFriendly: boolean
  childAgeBands: string[]
  itinerary: PublishedItinerary
  coverImage: string | null
  saveCount: number
  commentCount: number
  adaptCount: number
  publishedAt: string | null
  updatedAt: string
  author: CommunityAuthor
  authorStats: { publicTrips: number; followers: number }
}

/** Publish state of one of the signed-in user's own trips */
export interface OwnPublication {
  id: string
  slug: string
  visibility: TripVisibility
  status: ContentStatus
  title: string
  description: string | null
  travelStyle: string | null
  budgetLevel: string | null
  travelMonth: number | null
  childAgeBands: string[]
  tips: string[]
}

/** A published trip as a discovery card */
export interface CommunityTripCard {
  id: string
  slug: string
  title: string
  destination: string
  country: string | null
  durationDays: number
  travelStyle: string | null
  budgetLevel: string | null
  familyFriendly: boolean
  childAgeBands: string[]
  coverImage: string | null
  /** First few day themes, as a preview of the plan */
  highlights: string[]
  description: string | null
  saveCount: number
  commentCount: number
  adaptCount: number
  publishedAt: string
  author: CommunityAuthor
  /** Sample content for design review (utils/community-demo.ts). Never stored or counted. */
  demo?: boolean
  /** Only demo cards have these: the app has no likes or featured picks yet */
  demoLikes?: number
  demoFeatured?: boolean
  demoImage?: string
}

/** A creator in "Top travel creators": real counts from public trips and follows */
export interface CommunityCreator {
  handle: string
  displayName: string
  avatarUrl: string | null
  tripCount: number
  followerCount: number
  demo?: boolean
}

export interface CommunityDestination {
  destination: string
  country: string | null
  count: number
}
