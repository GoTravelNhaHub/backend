export interface DealComparisonOption {
  provider: 'trip' | 'klook'
  label: string
  priceNote: string
  highlight: string
  baseUrl: string
}

export interface DealPageTemplate {
  id?: string
  slug: string
  /** Short outcome line on /deals hub cards (trust + scanability). */
  hubOutcome?: string
  title: string
  description: string
  destination: string
  heroImage: string
  heroImageSource?: 'manual' | 'og'
  heroImageFetchedAt?: string | null
  badge: string
  category: 'hotel' | 'flight' | 'activity'
  lastUpdatedLabel: string
  primaryProvider: 'trip' | 'klook'
  primaryCtaLabel: string
  primaryBaseUrl: string
  placementKey: string
  summaryBullets: string[]
  tips: string[]
  comparison: DealComparisonOption[]
  isActive?: boolean
  createdAt?: string
  updatedAt?: string
}

