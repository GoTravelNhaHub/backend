import { type HttpEvent, createError, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { buildAffiliateLink } from '../services/affiliate-link'

export async function dealsGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const limit = Math.min(parseInt(String(query.limit || '100'), 10), 300)
    const platform = query.platform ? String(query.platform).toLowerCase() : 'all'
    const category = query.category ? String(query.category).toLowerCase() : 'all'
    const sessionId = query.sessionId ? String(query.sessionId) : 'anonymous'

    // Only offers a partner currently sells
    const where: any = {
      isActive: true,
      availabilityStatus: 'available',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    }

    if (platform !== 'all') where.provider = platform
    if (category !== 'all') {
      where.entity = {
        category: { equals: category, mode: 'insensitive' }
      }
    }

    const offers = await prisma.affiliateOffer.findMany({
      where,
      take: limit,
      orderBy: [{ updatedAt: 'desc' }],
      include: {
        entity: true
      }
    })

    const data = offers.map((offer) => {
      const { url } = buildAffiliateLink({
        provider: offer.provider,
        baseUrl: offer.baseUrl,
        context: {
          entityId: offer.entityId,
          offerId: offer.id,
          placementKey: 'deals_grid',
          pagePath: '/explore',
          sessionId
        }
      })

      const price = offer.priceAmount || 0
      const originalPrice = Number((offer.metadata as any)?.originalPrice || 0)
      // Only claim a discount we can show both prices for
      const discountPercent = originalPrice > 0 && price > 0 && originalPrice > price
        ? Math.round(((originalPrice - price) / originalPrice) * 100)
        : 0

      return {
        id: offer.id,
        platform: offer.provider,
        title: offer.entity?.title || 'Travel deal',
        description: (offer.metadata as any)?.description || null,
        category: offer.entity?.category || 'activity',
        location: offer.entity?.location || null,
        image: (offer.metadata as any)?.image || null,
        discountedPrice: price || null,
        originalPrice: originalPrice > price ? originalPrice : null,
        currency: offer.currency || 'SGD',
        discountPercent: discountPercent || null,
        affiliateLink: url,
        createdAt: offer.updatedAt,
        // When the partner price was last confirmed; null means never verified
        priceCheckedAt: offer.lastVerifiedAt,
        validUntil: offer.expiresAt,
        availabilityStatus: offer.availabilityStatus
      }
    })

    return {
      success: true,
      data
    }
  } catch (error: any) {
    console.error('Affiliate deals fetch error:', error)
    throw createError({
      statusCode: error?.statusCode && error.statusCode < 500 ? error.statusCode : 500,
      message: error?.statusCode && error.statusCode < 500 ? error.message : 'Failed to fetch affiliate deals'
    })
  }
}

