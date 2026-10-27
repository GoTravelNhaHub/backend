// Shared between the trip planner API and pages

export type TripPace = 'relaxed' | 'balanced' | 'packed'

export interface TripPartyMember {
  name?: string
  age: number
  notes?: string
}

export interface ItineraryItem {
  slot: 'morning' | 'afternoon' | 'evening'
  /** Catalogue id (`sg:<uuid>` or `offer:<uuid>`), or null for free-form items */
  activityId: string | null
  title: string
  description: string
  familyTip: string | null
}

export interface Itinerary {
  title: string
  summary: string
  days: Array<{ date: string; theme: string; items: ItineraryItem[] }>
  tips: string[]
}

/** Live supplier data for a catalogue id. Prices never come from the model. */
export interface LiveActivity {
  id: string
  kind: 'attraction' | 'offer'
  title: string
  image: string | null
  category: string | null
  available: boolean
  priceFrom: number | null
  currency: string
  priceText: string | null
  /** Internal page for self-checkout attractions */
  href: string | null
  /** Partner offer, opened through /api/affiliate/click */
  offerId: string | null
  /** Verified https partner URL used only if click tracking fails. Not a price. */
  partnerUrl?: string | null
  provider: string | null
  checkedAt: string | null
  /** Available and checked by the supplier recently enough to show price and booking links */
  verified: boolean
  /** Place name from the supplier record, when one is stored. Not a map coordinate. */
  location: string | null
}

/** A catalogue activity ranked for a family, with live supplier data */
export interface RecommendedActivity extends LiveActivity {
  location: string | null
  duration: string | null
  ageRestriction: string | null
  summary: string | null
  /** Short, rule-based reasons such as "Suits ages 3+" */
  reasons: string[]
}
