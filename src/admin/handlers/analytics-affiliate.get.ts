import { type HttpEvent, createError, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function analyticsAffiliateGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const windowMinutes = Math.min(Math.max(parseInt(String(query.window ?? '60'), 10), 5), 10080)
    const since = new Date(Date.now() - windowMinutes * 60 * 1000)

    const [totalClicks, windowClicks, topProviders, topPlacements, topPages, recentClicks] = await Promise.all([
      prisma.affiliateClickEvent.count(),
      prisma.affiliateClickEvent.count({ where: { createdAt: { gte: since } } }),
      prisma.affiliateClickEvent.groupBy({
        by: ['provider'],
        where: { createdAt: { gte: since } },
        _count: { provider: true },
        orderBy: { _count: { provider: 'desc' } },
        take: 10
      }),
      prisma.affiliateClickEvent.groupBy({
        by: ['placementKey'],
        where: { createdAt: { gte: since } },
        _count: { placementKey: true },
        orderBy: { _count: { placementKey: 'desc' } },
        take: 10
      }),
      prisma.affiliateClickEvent.groupBy({
        by: ['pagePath'],
        where: { createdAt: { gte: since } },
        _count: { pagePath: true },
        orderBy: { _count: { pagePath: 'desc' } },
        take: 10
      }),
      prisma.affiliateClickEvent.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 50
      })
    ])

    return {
      success: true,
      data: {
        totals: {
          totalClicks,
          windowClicks,
          windowMinutes
        },
        topProviders: topProviders.map((r) => ({ provider: r.provider, count: r._count.provider })),
        topPlacements: topPlacements
          .filter((r) => r.placementKey)
          .map((r) => ({ placementKey: r.placementKey, count: r._count.placementKey })),
        topPages: topPages
          .filter((r) => r.pagePath)
          .map((r) => ({ pagePath: r.pagePath, count: r._count.pagePath })),
        recent: recentClicks
      }
    }
  } catch (error: any) {
    console.error('Affiliate analytics fetch error:', error)
    throw createError({
      statusCode: error?.statusCode || 500,
      message: 'Failed to fetch affiliate analytics'
    })
  }
}

