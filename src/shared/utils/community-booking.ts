// Per-day booking suggestions on a community trip page (Reference B: Trip.com hotels, Klook activities).
// Honesty rules (docs/community-visual-spec.md §6): a price or a specific product appears only for a
// verified catalogue activity; everything else is a partner search link with no price.
import type { ItineraryItem, LiveActivity } from '../types/trip'
import { SEARCH_CITIES, tripHotelUrl } from './trip-search'

export type KlookSuggestion =
  | { kind: 'offer'; activity: LiveActivity }
  | { kind: 'search'; query: string; label: string }

export interface DaySuggestions {
  day: number
  /** Where to stay: only on the first day, and only for cities Trip.com search knows */
  hotels: { city: string; url: string } | null
  activities: KlookSuggestion[]
}

const MAX_ACTIVITIES_PER_DAY = 3

// Stops that are not things to book: meals, rest, hotel, transfers, free time
const NOT_BOOKABLE = /\b(breakfast|brunch|lunch|dinner|supper|meal|snack|coffee|caf[eé]|hawker|food court|rest|nap|relax|hotel|check[- ]?in|check[- ]?out|airport|arriv|depart|transfer|flight|free time|downtime|stroll|walk around|pack)\b/i

const cityOf = (destination: string) => {
  const needle = destination.trim().toLowerCase()
  return SEARCH_CITIES.find((city) => needle.includes(city.name.toLowerCase())) ?? null
}

export const klookSearchUrl = (localePath: string, query: string) =>
  `https://www.klook.com/${localePath}/search/result/?query=${encodeURIComponent(query)}`

/** Klook search wording: the stop's name, plus the city when the name does not already say it */
export const klookQuery = (title: string, destination: string) => {
  const clean = title.replace(/\s+/g, ' ').trim().slice(0, 80)
  return clean.toLowerCase().includes(destination.toLowerCase()) ? clean : `${clean} ${destination}`
}

export function daySuggestions(
  days: Array<{ theme: string; items: ItineraryItem[] }>,
  activities: Record<string, LiveActivity>,
  destination: string
): DaySuggestions[] {
  const city = cityOf(destination)
  const seenQueries = new Set<string>()
  const seenOffers = new Set<string>()

  return days.map((day, index) => {
    const offers: KlookSuggestion[] = []
    const searches: KlookSuggestion[] = []
    for (const item of day.items) {
      const activity = item.activityId ? activities[item.activityId] : undefined
      // Verified catalogue activity: may carry a price (checked by the supplier)
      if (activity?.verified && (activity.offerId || activity.href) && !seenOffers.has(activity.id)) {
        seenOffers.add(activity.id)
        offers.push({ kind: 'offer', activity })
        continue
      }
      if (NOT_BOOKABLE.test(item.title)) continue
      const query = klookQuery(item.title, destination)
      const key = query.toLowerCase()
      if (seenQueries.has(key)) continue
      seenQueries.add(key)
      searches.push({ kind: 'search', query, label: item.title })
    }
    return {
      day: index + 1,
      hotels:
        index === 0 && city
          ? { city: city.name, url: tripHotelUrl({ cityId: city.hotelCityId, adults: 2, children: 0, rooms: 1 }) }
          : null,
      activities: [...offers, ...searches].slice(0, MAX_ACTIVITIES_PER_DAY)
    }
  })
}
