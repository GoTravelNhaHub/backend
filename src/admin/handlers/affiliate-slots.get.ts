import { type HttpEvent, createError } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function affiliateSlotsGet(event: HttpEvent) {
  try {
    const offers = await prisma.affiliateOffer.findMany({
      where: {
        provider: { in: ['trip', 'trip.com', 'klook'] }
      },
      include: {
        entity: true
      },
      orderBy: [{ updatedAt: 'desc' }]
    })

    const slots = offers
      .filter((offer) => Boolean((offer.metadata as any)?.dealSlot))
      .map((offer) => {
        const metadata = (offer.metadata || {}) as Record<string, any>
        const provider = offer.provider === 'trip.com' ? 'trip' : offer.provider
        return {
          id: offer.id,
          entityId: offer.entityId,
          entitySlug: offer.entity?.slug || null,
          title: offer.entity?.title || 'Untitled slot',
          provider,
          category: offer.entity?.category || 'activity',
          destination: String(metadata.destination || offer.entity?.location || 'global').toLowerCase(),
          description: String(metadata.description || ''),
          baseUrl: offer.baseUrl,
          isActive: offer.isActive,
          priority: Number(metadata.priority || 0) || 0,
          updatedAt: offer.updatedAt
        }
      })

    return {
      success: true,
      data: slots
    }
  } catch (error: any) {
    console.error('Failed to fetch affiliate slots:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch affiliate slots'
    })
  }
}
