import type { DealComparisonOption, DealPageTemplate } from '../../shared/types/deal-template'

/** Direct www.klook.com URLs so iOS universal links can open the Klook app; aid/aff_adid preserved. */
const DEFAULT_KLOOK_FLIGHT_REDIRECT =
  'https://www.klook.com/en-PH/transport/?target_slug=/flight&aid=89020&aff_adid=1274076'

const DEFAULT_KLOOK_HOTEL_REDIRECT =
  'https://www.klook.com/en-SG/hotels/?spm=Home.TopSearchBar_MainNode_LIST&clickId=dcb7b90dc2&aid=89020&aff_adid=1274076'

const DEFAULT_KLOOK_ATTRACTION_REDIRECT =
  'https://www.klook.com/en-SG/attractions/singapore/c6/?aid=89020&aff_adid=1274076'

function tripFlightUrl(publicCfg: Record<string, any> | undefined): string {
  const allianceId = publicCfg?.TRIP_ALLIANCE_ID || '3883416'
  const sid = publicCfg?.TRIP_SID || '22874365'
  const baseUrl = publicCfg?.TRIP_BASE_URL || 'https://www.trip.com'
  const campaign = 'hub-flight-comparison'
  return `${baseUrl}/flights?Allianceid=${allianceId}&SID=${sid}&trip_campaign=${encodeURIComponent(campaign)}`
}

function tripHotelUrl(publicCfg: Record<string, any> | undefined): string {
  const allianceId = publicCfg?.TRIP_ALLIANCE_ID || '3883416'
  const sid = publicCfg?.TRIP_SID || '22874365'
  const baseUrl = publicCfg?.TRIP_BASE_URL || 'https://www.trip.com'
  const campaign = 'hub-hotel-comparison'
  return `${baseUrl}/hotels/list?Allianceid=${allianceId}&SID=${sid}&trip_campaign=${encodeURIComponent(campaign)}`
}

function tripAttractionUrl(publicCfg: Record<string, any> | undefined): string {
  const allianceId = publicCfg?.TRIP_ALLIANCE_ID || '3883416'
  const sid = publicCfg?.TRIP_SID || '22874365'
  const baseUrl = publicCfg?.TRIP_BASE_URL || 'https://www.trip.com'
  const campaign = 'hub-attraction-comparison'
  return `${baseUrl}/things-to-do/?Allianceid=${allianceId}&SID=${sid}&trip_campaign=${encodeURIComponent(campaign)}`
}

export function getBuiltinDealTemplate(
  slug: string,
  publicCfg: Record<string, any> | undefined
): DealPageTemplate | null {
  const klookFlight =
    publicCfg?.KLOOK_AFFILIATE_FLIGHT_REDIRECT_URL || DEFAULT_KLOOK_FLIGHT_REDIRECT
  const klookHotel =
    publicCfg?.KLOOK_AFFILIATE_HOTEL_REDIRECT_URL || DEFAULT_KLOOK_HOTEL_REDIRECT
  const klookAttraction =
    publicCfg?.KLOOK_AFFILIATE_ATTRACTION_REDIRECT_URL || DEFAULT_KLOOK_ATTRACTION_REDIRECT

  const tripF = tripFlightUrl(publicCfg)
  const tripH = tripHotelUrl(publicCfg)
  const tripA = tripAttractionUrl(publicCfg)

  if (slug === 'flights') {
    const comparison: DealComparisonOption[] = [
      {
        provider: 'trip',
        label: 'Trip.com Flights',
        priceNote: 'Search flights across many airlines and routes in one place.',
        highlight: 'Great for flexible route options and quick fare checks.',
        baseUrl: tripF
      },
      {
        provider: 'klook',
        label: 'Klook Flights',
        priceNote: 'Go to Klook flight and transport booking pages.',
        highlight: 'Useful when you also plan to book activities on Klook.',
        baseUrl: klookFlight
      }
    ]

    return {
      slug: 'flights',
      hubOutcome:
        'Open flight search on Trip.com and Klook from one page, then book where the total works best for you.',
      title: 'Find your best flight booking option',
      description:
        'Open flight search on Trip.com and Klook, check the total fare on each, then book where it works best for your trip.',
      destination: 'Worldwide',
      heroImage:
        'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1600&q=80',
      heroImageSource: 'manual',
      badge: 'Flights',
      category: 'flight',
      lastUpdatedLabel: 'Partner search pages',
      primaryProvider: 'trip',
      primaryCtaLabel: 'Check Live Price',
      primaryBaseUrl: tripF,
      placementKey: 'hub_flights_comparison',
      summaryBullets: [
        'Compare booking options from trusted travel partners in one place.',
        'Review total fare, baggage, and add-on costs before checkout.',
        'Change dates to spot lower fares quickly.'
      ],
      tips: [
        'Try mid-week departures when your schedule allows.',
        'Use incognito or clear cookies if you see price jumps between visits.',
        'Confirm visa and transit rules before booking discounted fares.'
      ],
      comparison,
      isActive: true
    }
  }

  if (slug === 'hotels') {
    const comparison: DealComparisonOption[] = [
      {
        provider: 'trip',
        label: 'Trip.com Hotels',
        priceNote: 'Browse hotels from budget to premium with easy filters.',
        highlight: 'Good choice when you want broad hotel coverage.',
        baseUrl: tripH
      },
      {
        provider: 'klook',
        label: 'Klook Hotels',
        priceNote: 'Open Klook hotel pages and check current room rates.',
        highlight: 'Great if you plan to bundle hotels with Klook activities.',
        baseUrl: klookHotel
      }
    ]

    return {
      slug: 'hotels',
      hubOutcome: 'Open hotel search on Trip.com and Klook and check room types and totals on each.',
      title: 'Find your best hotel booking option',
      description:
        'Compare hotel booking pages on Trip.com and Klook to find the right stay and rate.',
      destination: 'Worldwide',
      heroImage:
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1600&q=80',
      heroImageSource: 'manual',
      badge: 'Hotels',
      category: 'hotel',
      lastUpdatedLabel: 'Partner search pages',
      primaryProvider: 'trip',
      primaryCtaLabel: 'Check Live Price',
      primaryBaseUrl: tripH,
      placementKey: 'hub_hotels_comparison',
      summaryBullets: [
        'Compare room options from two trusted booking partners.',
        'Check promo rates and member perks on each platform.',
        'Always confirm cancellation terms before paying.'
      ],
      tips: [
        'Compare total stay price with taxes and resort fees.',
        'Book flexible rates when travel plans might change.',
        'Check map location and reviews on the partner site before paying.'
      ],
      comparison,
      isActive: true
    }
  }

  if (slug === 'attractions') {
    const comparison: DealComparisonOption[] = [
      {
        provider: 'trip',
        label: 'Trip.com Attractions',
        priceNote: 'Browse attraction and things-to-do tickets quickly.',
        highlight: 'Great for comparing popular city experiences.',
        baseUrl: tripA
      },
      {
        provider: 'klook',
        label: 'Klook Attractions',
        priceNote: 'Open Klook attraction listings and ticket options.',
        highlight: 'Excellent when bundling tickets and experiences on Klook.',
        baseUrl: klookAttraction
      }
    ]

    return {
      slug: 'attractions',
      hubOutcome: 'Open Singapore ticket pages on Trip.com and Klook and check what each one includes.',
      title: 'Find your best attraction ticket option',
      description:
        'Compare attraction ticket pages on Trip.com and Klook, then book where value is best.',
      destination: 'Singapore',
      heroImage:
        'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=1600&q=80',
      heroImageSource: 'manual',
      badge: 'Attractions',
      category: 'activity',
      lastUpdatedLabel: 'Partner attraction pages',
      primaryProvider: 'trip',
      primaryCtaLabel: 'Check Live Price',
      primaryBaseUrl: tripA,
      placementKey: 'hub_attractions_comparison',
      summaryBullets: [
        'Open both partners\' attraction pages from one place.',
        'See price differences and ticket inclusions before checkout.',
        'Pick the option that matches your schedule and budget.'
      ],
      tips: [
        'Compare inclusions like fast-track, bundles, and cancellation policy.',
        'Check blackout dates and same-day redemption rules before checkout.',
        'Use weekday visits where possible for lower crowd levels.'
      ],
      comparison,
      isActive: true
    }
  }

  return null
}

export function listBuiltinDealTemplates(
  publicCfg: Record<string, any> | undefined
): DealPageTemplate[] {
  const out: DealPageTemplate[] = []
  const flights = getBuiltinDealTemplate('flights', publicCfg)
  const hotels = getBuiltinDealTemplate('hotels', publicCfg)
  const attractions = getBuiltinDealTemplate('attractions', publicCfg)
  if (flights) out.push(flights)
  if (hotels) out.push(hotels)
  if (attractions) out.push(attractions)
  return out
}
