import { type HttpEvent, createError, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

interface SearchRequest {
  query: string
  platforms?: string[] // ['trip', 'klook']
  category?: string // 'hotel', 'flight', 'activity', 'attraction'
  location?: string
  limit?: number
  page?: number
}

interface SearchResult {
  id: string
  platform: string
  platformLabel: string
  title: string
  description?: string
  price?: string | number
  priceCheckedAt?: string
  priceAmount?: number
  originalPrice?: string | number
  originalPriceAmount?: number
  currency?: string
  image?: string
  link?: string
  category?: string
  location?: string
  rating?: number
  discount?: string | number
  promoCode?: string
  metadata?: Record<string, any>
  relevanceScore?: number
}

function normalizeProvider(platform: string): string {
  const value = String(platform || '').toLowerCase().trim()
  if (value === 'trip.com') return 'trip'
  return value
}

/**
 * POST /api/search/global
 * Unified search across Trip.com and Klook
 */
export async function globalPost(event: HttpEvent) {
  try {
    const body = (await readBody(event)) as SearchRequest
    const { query, platforms = ['trip', 'klook'], category, location, limit = 20, page = 1 } = body

    if (!query || query.trim().length === 0) {
      return {
        success: true,
        data: [],
        total: 0,
        platforms: {},
        pagination: {
          page: 1,
          limit,
          totalPages: 0
        }
      }
    }

    const searchQuery = query.trim()
    const safePage = Math.max(Number(page) || 1, 1)
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 100)
    const offset = (safePage - 1) * safeLimit

    const normalizedPlatforms = (platforms || ['trip', 'klook']).map(normalizeProvider)

    const where: any = {
      isActive: true,
      provider: { in: [...new Set([...normalizedPlatforms, 'trip.com'])] },
      // Stale offers have unconfirmed prices, so they aren't returned as results
      availabilityStatus: 'available',
      AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }],
      entity: {
        status: 'active'
      }
    }

    if (searchQuery) {
      where.OR = [
        {
          entity: {
            title: { contains: searchQuery, mode: 'insensitive' }
          }
        },
        {
          entity: {
            location: { contains: searchQuery, mode: 'insensitive' }
          }
        },
        {
          entity: {
            category: { contains: searchQuery, mode: 'insensitive' }
          }
        },
        {
          priceText: { contains: searchQuery, mode: 'insensitive' }
        }
      ]
    }

    if (category) {
      where.entity = {
        ...(where.entity || {}),
        category: { contains: category, mode: 'insensitive' }
      }
    }

    if (location) {
      where.entity = {
        ...(where.entity || {}),
        location: { contains: location, mode: 'insensitive' }
      }
    }

    const [offers, total, groupedProviders] = await Promise.all([
      prisma.affiliateOffer.findMany({
        where,
        include: {
          entity: true
        },
        skip: offset,
        take: safeLimit,
        orderBy: [{ score: 'desc' }, { updatedAt: 'desc' }]
      }),
      prisma.affiliateOffer.count({ where }),
      prisma.affiliateOffer.groupBy({
        by: ['provider'],
        where,
        _count: { provider: true }
      })
    ])

    const platformCounts: Record<string, number> = {}
    for (const grouped of groupedProviders) {
      platformCounts[grouped.provider] = grouped._count.provider
    }

    const results: SearchResult[] = offers.map((offer) => {
      const metadata = (offer.metadata || {}) as Record<string, any>
      const description =
        typeof metadata.description === 'string'
          ? metadata.description
          : typeof offer.priceText === 'string'
            ? offer.priceText
            : ''
      const ratingRaw = Number(metadata.rating)
      const discountRaw = metadata.discount ?? metadata.discountPercent ?? null

      return {
        id: offer.id,
        platform: normalizeProvider(offer.provider),
        platformLabel: getPlatformLabel(offer.provider),
        title: offer.entity?.title || 'Untitled Offer',
        description,
        price: offer.priceText || offer.priceAmount || undefined,
        priceAmount: offer.priceAmount || undefined,
        originalPrice: metadata.originalPrice ?? undefined,
        originalPriceAmount: Number(metadata.originalPrice) || undefined,
        currency: offer.currency || 'SGD',
        priceCheckedAt: offer.lastVerifiedAt?.toISOString(),
        image: (metadata.image as string) || undefined,
        link: offer.baseUrl || offer.affiliateUrl || undefined,
        category: offer.entity?.category || undefined,
        location: offer.entity?.location || undefined,
        rating: Number.isFinite(ratingRaw) ? ratingRaw : undefined,
        discount: discountRaw || undefined,
        promoCode: (metadata.promoCode as string) || undefined,
        metadata,
        relevanceScore: calculateRelevance(searchQuery, offer.entity?.title || '', description)
      }
    })

    return {
      success: true,
      data: results,
      total,
      platforms: platformCounts,
      pagination: {
        page: safePage,
        limit: safeLimit,
        totalPages: Math.ceil(total / safeLimit)
      },
      query: searchQuery,
      filters: {
        platforms,
        category,
        location
      }
    }
  } catch (error: any) {
    console.error('Error in unified search:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to perform search'
    })
  }
}

function getPlatformLabel(platform: string): string {
  const normalized = platform.toLowerCase()
  if (normalized === 'trip' || normalized === 'trip.com') return 'Trip.com'
  if (normalized === 'klook') return 'Klook'
  return platform
}

/**
 * Calculate relevance score based on query matching
 */
function calculateRelevance(query: string, title: string, description: string): number {
  const queryLower = query.toLowerCase()
  const titleLower = title.toLowerCase()
  const descLower = description.toLowerCase()

  let score = 0

  // Exact title match
  if (titleLower === queryLower) {
    score += 100
  }
  // Title starts with query
  else if (titleLower.startsWith(queryLower)) {
    score += 80
  }
  // Title contains query
  else if (titleLower.includes(queryLower)) {
    score += 60
  }

  // Description contains query
  if (descLower.includes(queryLower)) {
    score += 20
  }

  // Word matching
  const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
  const titleWords = titleLower.split(/\s+/)
  const descWords = descLower.split(/\s+/)

  queryWords.forEach(word => {
    if (titleWords.includes(word)) score += 10
    if (descWords.includes(word)) score += 5
  })

  return score
}

