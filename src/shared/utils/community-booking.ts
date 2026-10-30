// Per-day booking suggestions on a community trip page (Reference B: Trip.com hotels, Klook activities).
// Honesty rules (docs/community-visual-spec.md §6): a price or a specific product appears only for a
// verified catalogue activity; everything else is a partner search link with no price.
import type { ItineraryItem, LiveActivity } from '../types/trip'
import { SEARCH_CITIES, tripHotelUrl } from './trip-search'

/** A partner product page found for a stop by AI web search (api: /community/trips/:slug/partner-links) */
export interface MatchedProduct {
  provider: 'klook' | 'trip'
  url: string
  title: string | null
}

/** What AI web search found for a stop's search query */
export interface StopMatch {
  product: MatchedProduct | null
  /** Short Klook search seen to return related listings; null when Klook has nothing related */
  search: string | null
}

export type KlookSuggestion =
  | { kind: 'offer'; activity: LiveActivity }
  // `link` is filled in on the page once a matching product page is known; otherwise it is a partner search
  | { kind: 'search'; query: string; label: string; link?: MatchedProduct | null; search?: string }

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

// Words that describe the visit rather than name the place
const LEADING_WORDS = /^(?:(?:morning|afternoon|evening|half[- ]day|full[- ]day|day trip|explore|visit|discover|tour|see|enjoy|experience|stroll|relax)\b[\s:,-]*(?:at|in|around|to|the)?\s+)+/i
const MAX_QUERY_WORDS = 6

/**
 * Klook search wording for a stop. Klook's search matches short names, so a sentence such as
 * "Jacob Ballas Children's Garden at Singapore Botanic Gardens" finds nothing: keep the place
 * after the last "at", drop notes in brackets and visit words, then add the city when missing.
 */
export const klookQuery = (title: string, destination: string) => {
  let clean = title.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  clean = clean.split(/\s+[–—-]\s+/)[0]
  clean = clean.includes(':') ? clean.slice(clean.lastIndexOf(':') + 1) : clean
  const at = clean.match(/^.*\s(?:at|@)\s+(.+)$/i)
  if (at) clean = at[1]
  clean = clean.replace(LEADING_WORDS, '').trim() || title.trim()
  clean = clean.split(' ').slice(0, MAX_QUERY_WORDS).join(' ').slice(0, 80)
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

/**
 * Apply what AI web search found, keyed by search query: a product page replaces the search,
 * a better keyword replaces the search text, and a stop Klook has nothing for loses its button
 * (an empty search page helps no one). Stops not looked up yet keep their search.
 */
export const withMatchedProducts = (days: DaySuggestions[], links: Record<string, StopMatch>): DaySuggestions[] =>
  days.map((day) => ({
    ...day,
    activities: day.activities.flatMap((entry): KlookSuggestion[] => {
      const match = entry.kind === 'search' ? links[entry.query] : undefined
      if (entry.kind !== 'search' || !match) return [entry]
      if (match.product) return [{ ...entry, link: match.product }]
      return match.search ? [{ ...entry, search: match.search }] : []
    })
  }))

/** Klook product pages are stored without a locale; open them in the visitor's language */
export const localizedPartnerUrl = (link: MatchedProduct, klookLocalePath: string) =>
  link.provider === 'klook' ? link.url.replace(/^https:\/\/www\.klook\.com\//, `https://www.klook.com/${klookLocalePath}/`) : link.url
