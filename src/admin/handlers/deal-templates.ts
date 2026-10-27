import { type HttpEvent, getQuery, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function dealTemplates(event: HttpEvent) {
  if (event.req.method === 'GET') {
    try {
      const query = getQuery(event)
      const activeOnly = query.activeOnly === 'true'
      const search = String(query.search || '').trim()
      const page = Math.max(1, parseInt(String(query.page || '1'), 10))
      const limit = Math.max(1, Math.min(parseInt(String(query.limit || '20'), 10), 100))
      const skip = (page - 1) * limit
      const where = {
        ...(activeOnly ? { isActive: true } : {}),
        ...(search
          ? {
              OR: [
                { slug: { contains: search, mode: 'insensitive' as const } },
                { title: { contains: search, mode: 'insensitive' as const } },
                { destination: { contains: search, mode: 'insensitive' as const } }
              ]
            }
          : {})
      }
      const [templates, total] = await Promise.all([
        prisma.dealTemplate.findMany({
          where,
          orderBy: [{ updatedAt: 'desc' }],
          skip,
          take: limit
        }),
        prisma.dealTemplate.count({ where })
      ])

      return {
        success: true,
        data: templates,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch admin deal templates:', error)
      return {
        success: false,
        error: 'Failed to fetch templates',
        data: []
      }
    }
  }

  if (event.req.method === 'POST') {
    try {
      const body = await readBody(event)
      const created = await prisma.dealTemplate.create({
        data: {
          slug: body.slug,
          title: body.title,
          description: body.description,
          destination: body.destination,
          heroImage: body.heroImage,
          heroImageSource: body.heroImageSource || 'manual',
          heroImageFetchedAt: body.heroImageFetchedAt || null,
          badge: body.badge,
          category: body.category,
          lastUpdatedLabel: body.lastUpdatedLabel,
          primaryProvider: body.primaryProvider,
          primaryCtaLabel: body.primaryCtaLabel,
          primaryBaseUrl: body.primaryBaseUrl,
          placementKey: body.placementKey,
          summaryBullets: body.summaryBullets || [],
          tips: body.tips || [],
          comparison: body.comparison || [],
          isActive: body.isActive !== false
        }
      })

      return {
        success: true,
        data: created
      }
    } catch (error: any) {
      console.error('Failed to create deal template:', error)
      return {
        success: false,
        error: 'Failed to create template'
      }
    }
  }

  return {
    success: false,
    error: 'Method not allowed'
  }
}

