import prisma from '../../prisma/prisma.client'
import { buildAffiliateLink } from './affiliate-link'

type ResolveOfferParams = {
  entityId?: string
  slug?: string
  placementKey?: string
  pagePath?: string
  sessionId?: string
}

function scoreOffer(offer: any): number {
  let score = offer.score || 0

  if (offer.availabilityStatus === 'available') score += 100
  if (offer.availabilityStatus === 'stale') score += 20
  if (!offer.isActive) score -= 1000

  if (offer.lastVerifiedAt) {
    const ageHours = (Date.now() - new Date(offer.lastVerifiedAt).getTime()) / (1000 * 60 * 60)
    if (ageHours <= 24) score += 20
    else if (ageHours <= 72) score += 10
  }

  if (typeof offer.priceAmount === 'number' && offer.priceAmount > 0) {
    score += Math.max(0, 50 - offer.priceAmount / 10)
  }

  return score
}

export async function resolveAffiliateOffers(params: ResolveOfferParams) {
  let entity: any = null
  if (params.entityId) {
    entity = await prisma.affiliateEntity.findUnique({ where: { id: params.entityId } })
  } else if (params.slug) {
    entity = await prisma.affiliateEntity.findUnique({ where: { slug: params.slug } })
  }

  if (!entity) {
    return {
      success: true,
      entity: null,
      primary: null,
      alternatives: [],
      fallbackState: 'no_entity'
    }
  }

  const offers = await prisma.affiliateOffer.findMany({
    where: {
      entityId: entity.id,
      isActive: true
    },
    orderBy: [
      { updatedAt: 'desc' }
    ]
  })

  const ranked = offers
    .map((offer: any) => ({ ...offer, _computedScore: scoreOffer(offer) }))
    .sort((a: any, b: any) => b._computedScore - a._computedScore)

  if (ranked.length === 0) {
    return {
      success: true,
      entity,
      primary: null,
      alternatives: [],
      fallbackState: 'no_offer'
    }
  }

  const normalizeOffer = (offer: any) => {
    const { url, subId } = buildAffiliateLink({
      provider: offer.provider,
      baseUrl: offer.baseUrl,
      context: {
        entityId: entity.id,
        offerId: offer.id,
        placementKey: params.placementKey,
        pagePath: params.pagePath,
        sessionId: params.sessionId
      }
    })

    return {
      ...offer,
      outboundUrl: url,
      subId
    }
  }

  return {
    success: true,
    entity,
    primary: normalizeOffer(ranked[0]),
    alternatives: ranked.slice(1, 4).map(normalizeOffer),
    fallbackState: ranked[0].availabilityStatus === 'available' ? 'direct' : 'fallback'
  }
}

