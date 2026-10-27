import { type HttpEvent, createError, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function klookGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const page = parseInt(String(query.page || '1'), 10)
    const limit = Math.min(parseInt(String(query.limit || '50'), 10), 200)
    const skip = (page - 1) * limit
    const search = String(query.search || '').toLowerCase()
    const status = String(query.status || 'all')
    const sort = String(query.sort || 'latest')

    const where: any = {
      provider: 'klook'
    }

    // Status filter (isActive for now, can be extended to isPublished later)
    if (status === 'active') {
      where.isActive = true
    } else if (status === 'inactive') {
      where.isActive = false
    }

    if (search) {
      where.entity = {
        is: {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { location: { contains: search, mode: 'insensitive' } },
            { category: { contains: search, mode: 'insensitive' } }
          ]
        }
      }
    }

    const [offers, total] = await Promise.all([
      prisma.affiliateOffer.findMany({
        where,
        include: {
          entity: true
        }
      }),
      prisma.affiliateOffer.count({ where })
    ])

    const mapped = offers.map((offer) => {
      const metadata = (offer.metadata || {}) as Record<string, any>
      const originalPriceAmount = Number(metadata.originalPrice || 0) || null
      return {
        id: offer.id,
        title: offer.entity?.title || 'Untitled Klook Offer',
        description: metadata.description || null,
        priceAmount: offer.priceAmount,
        priceText: offer.priceText,
        originalPriceAmount,
        currency: offer.currency || 'SGD',
        image: metadata.image || null,
        link: offer.baseUrl || offer.affiliateUrl || null,
        location: offer.entity?.location || null,
        category: offer.entity?.category || null,
        rating: Number(metadata.rating || 0) || null,
        reviewCount: Number(metadata.reviewCount || 0) || null,
        isActive: offer.isActive,
        createdAt: offer.createdAt,
        updatedAt: offer.updatedAt
      }
    })

    mapped.sort((a, b) => {
      switch (sort) {
        case 'alpha':
          return (a.title || '').localeCompare(b.title || '')
        case 'priceAsc':
          return Number(a.priceAmount || 0) - Number(b.priceAmount || 0)
        case 'priceDesc':
          return Number(b.priceAmount || 0) - Number(a.priceAmount || 0)
        case 'latest':
        default:
          return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      }
    })

    const data = mapped.slice(skip, skip + limit)

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    }
  } catch (error: any) {
    console.error('Admin Klook events fetch error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to load Klook events'
    })
  }
}
