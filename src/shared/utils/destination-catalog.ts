import { destinationSlug } from './destination-slug'

// Cities the AI Travel Agent knows by name (pages/planner/index.vue CITIES).
// Shared by the home page "Where to next?" row and the /destinations page.

export type DestinationRegion = 'Southeast Asia' | 'East Asia' | 'Oceania'

export interface CatalogDestination {
  name: string
  country: string
  region: DestinationRegion
  caption: string
  /** Shown in the six-city row on the home page */
  featured?: boolean
}

export const DESTINATIONS: CatalogDestination[] = [
  { name: 'Singapore', country: 'Singapore', region: 'Southeast Asia', caption: 'Zoos, gardens and food', featured: true },
  { name: 'Tokyo', country: 'Japan', region: 'East Asia', caption: 'Theme parks and culture', featured: true },
  { name: 'Bangkok', country: 'Thailand', region: 'Southeast Asia', caption: 'Markets and temples', featured: true },
  { name: 'Bali', country: 'Indonesia', region: 'Southeast Asia', caption: 'Beaches and easy days', featured: true },
  { name: 'Hong Kong', country: 'Hong Kong', region: 'East Asia', caption: 'Views and dim sum', featured: true },
  { name: 'Seoul', country: 'South Korea', region: 'East Asia', caption: 'Palaces and play cafés', featured: true },
  { name: 'Kuala Lumpur', country: 'Malaysia', region: 'Southeast Asia', caption: 'Twin towers and city parks' },
  { name: 'Phuket', country: 'Thailand', region: 'Southeast Asia', caption: 'Beaches and island trips' },
  { name: 'Hanoi', country: 'Vietnam', region: 'Southeast Asia', caption: 'Old Quarter and lakes' },
  { name: 'Ho Chi Minh City', country: 'Vietnam', region: 'Southeast Asia', caption: 'Street food and history' },
  { name: 'Osaka', country: 'Japan', region: 'East Asia', caption: 'Food streets and Universal Studios' },
  { name: 'Taipei', country: 'Taiwan', region: 'East Asia', caption: 'Night markets and Taipei 101' },
  { name: 'Sydney', country: 'Australia', region: 'Oceania', caption: 'Harbour, beaches and zoos' }
]

export const DESTINATION_REGIONS: DestinationRegion[] = ['Southeast Asia', 'East Asia', 'Oceania']

export const catalogSlug = (destination: CatalogDestination) => destinationSlug(destination.name)

/** "Japan · Theme parks and culture", or just the caption when the country is the city itself. */
export const catalogCaption = (destination: CatalogDestination) =>
  destination.country && destination.country !== destination.name ? `${destination.country} · ${destination.caption}` : destination.caption
