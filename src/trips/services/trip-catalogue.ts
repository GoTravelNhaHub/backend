import prisma from '../../prisma/prisma.client'
import type { LiveActivity } from '../../shared/types/trip'
import { isApprovedPartnerUrl } from '../../shared/utils/partner-url'

// Catalogue ids handed to the model are prefixed with the table:
//   offer:<AffiliateOffer.id>   partner offers (Klook, Trip.com, ...)
// Plans saved before 2026-10-27 may also hold sg:<id> (retired AttractionsSG self-checkout);
// those now resolve as "No longer listed".

export interface CatalogueItem {
  id: string
  title: string
  category: string | null
  location: string | null
  duration: string | null
  ageRestriction: string | null
  /** Indicative per-person price so the model can respect the budget. Never shown from model output. */
  indicativePrice: string | null
  summary: string | null
}

const MAX_OFFERS = 60
// A price or booking link older than this is treated as unchecked
const VERIFIED_WITHIN_DAYS = 7

const clip = (value: string | null | undefined, length: number) => {
  if (!value) return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > length ? `${text.slice(0, length)}…` : text
}

const formatPrice = (amount: number | null | undefined, currency: string) =>
  typeof amount === 'number' && amount > 0 ? `${currency} ${amount.toFixed(2)}` : null

const metadataImage = (metadata: unknown) =>
  metadata && typeof metadata === 'object' && typeof (metadata as any).image === 'string'
    ? ((metadata as any).image as string)
    : null

/** Bookable partner offers for a destination. */
export async function loadCatalogue(destination: string): Promise<CatalogueItem[]> {
  const city = destination.split(',')[0].trim()
  const now = new Date()

  const offers = city
    ? await prisma.affiliateOffer.findMany({
        where: {
          isActive: true,
          availabilityStatus: 'available',
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          entity: { status: 'active', location: { contains: city, mode: 'insensitive' } }
        },
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
        take: MAX_OFFERS,
        include: { entity: true }
      })
    : []

  return [
    ...offers.map((offer) => ({
      id: `offer:${offer.id}`,
      title: offer.entity.title,
      category: offer.entity.category,
      location: offer.entity.location,
      duration: null,
      ageRestriction: null,
      indicativePrice: formatPrice(offer.priceAmount, offer.currency || 'SGD') ?? offer.priceText,
      summary: clip((offer.metadata as any)?.description, 240)
    }))
  ]
}

/**
 * Current price, availability and booking target for catalogue ids, read fresh from
 * the supplier tables. Ids that no longer exist come back as unavailable.
 */
export async function resolveActivities(ids: string[]): Promise<Record<string, LiveActivity>> {
  const unique = [...new Set(ids)]
  const offerIds = unique.filter((id) => id.startsWith('offer:')).map((id) => id.slice(6))
  const offers = offerIds.length
    ? await prisma.affiliateOffer.findMany({
        where: { id: { in: offerIds } },
        include: { entity: true }
      })
    : []

  const result: Record<string, LiveActivity> = {}
  const now = new Date()
  const checkedSince = now.getTime() - VERIFIED_WITHIN_DAYS * 86_400_000

  for (const offer of offers) {
    const available =
      offer.isActive &&
      offer.availabilityStatus === 'available' &&
      offer.entity.status === 'active' &&
      (!offer.expiresAt || offer.expiresAt > now)
    const verified = available && !!offer.lastVerifiedAt && offer.lastVerifiedAt.getTime() >= checkedSince
    result[`offer:${offer.id}`] = {
      id: `offer:${offer.id}`,
      kind: 'offer',
      title: offer.entity.title,
      image: metadataImage(offer.metadata),
      category: offer.entity.category,
      available,
      verified,
      priceFrom: typeof offer.priceAmount === 'number' && offer.priceAmount > 0 ? offer.priceAmount : null,
      currency: offer.currency || 'SGD',
      priceText: offer.priceText,
      href: null,
      offerId: offer.id,
      partnerUrl: verified && isApprovedPartnerUrl(offer.baseUrl) ? offer.baseUrl : null,
      provider: offer.provider,
      checkedAt: (offer.lastVerifiedAt ?? offer.updatedAt).toISOString(),
      location: offer.entity.location
    }
  }

  for (const id of unique) {
    if (!result[id]) {
      result[id] = {
        id,
        kind: id.startsWith('sg:') ? 'attraction' : 'offer',
        title: 'No longer listed',
        image: null,
        category: null,
        available: false,
        verified: false,
        priceFrom: null,
        currency: 'SGD',
        priceText: null,
        href: null,
        offerId: null,
        provider: null,
        checkedAt: null,
        location: null
      }
    }
  }

  return result
}
