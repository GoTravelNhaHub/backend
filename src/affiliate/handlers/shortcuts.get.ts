import { type HttpEvent, createError } from '../../common/http'
import prisma from '../../prisma/prisma.client'

type Provider = 'trip' | 'klook'

function normalizeProvider(value: string): Provider | null {
  const provider = String(value || '').toLowerCase().trim()
  if (provider === 'trip' || provider === 'trip.com') return 'trip'
  if (provider === 'klook') return 'klook'
  return null
}

function inferCategoryFromUrl(url: string, fallback = 'activity'): string {
  const lower = String(url || '').toLowerCase()
  if (lower.includes('/flights')) return 'flight'
  if (lower.includes('/hotels') || lower.includes('/hotel')) return 'hotel'
  if (lower.includes('/activity') || lower.includes('/tour') || lower.includes('/attraction')) return 'activity'
  return fallback
}

function platformLabel(provider: Provider): string {
  return provider === 'trip' ? 'Trip.com' : 'Klook'
}

export async function shortcutsGet(event: HttpEvent) {
  try {
    const offers = await prisma.affiliateOffer.findMany({
      where: {
        isActive: true,
        provider: { in: ['trip', 'trip.com', 'klook'] },
        availabilityStatus: { in: ['available', 'stale'] },
        entity: { status: 'active' }
      },
      include: { entity: true },
      orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }],
      take: 60
    })

    if (offers.length > 0) {
      const data = offers
        .map((offer) => {
          const provider = normalizeProvider(offer.provider)
          if (!provider) return null
          const metadata = (offer.metadata || {}) as Record<string, any>
          const category = (offer.entity?.category || '').toLowerCase() || inferCategoryFromUrl(offer.baseUrl, 'activity')
          const destination = String(metadata.destination || offer.entity?.location || 'global').toLowerCase()
          return {
            id: `offer-${offer.id}`,
            provider,
            providerLabel: platformLabel(provider),
            category,
            destination,
            title: offer.entity?.title || `${platformLabel(provider)} ${category} deals`,
            description: (metadata.description as string) || `Open ${platformLabel(provider)} ${category} offers`,
            link: offer.baseUrl || offer.affiliateUrl,
            image: (metadata.image as string) || null,
            location: offer.entity?.location || null,
            entityId: offer.entityId,
            entitySlug: offer.entity?.slug || null,
            offerId: offer.id,
            priority: Number(metadata.priority || 0) || 0
          }
        })
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .sort((a, b) => b.priority - a.priority || a.title.localeCompare(b.title))

      return {
        success: true,
        data,
        source: 'affiliate_offers'
      }
    }

    return {
      success: true,
      data: [],
      source: 'affiliate_offers'
    }
  } catch (error: any) {
    console.error('Affiliate shortcuts fetch error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch affiliate shortcuts'
    })
  }
}
