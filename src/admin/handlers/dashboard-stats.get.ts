import { type HttpEvent, createError } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import prisma from '../../prisma/prisma.client'
import { PLANNER_SITE_DAILY_LIMIT } from '../../planner/services/itinerary-generator'

const DAY_MS = 24 * 60 * 60 * 1000

// Admin dashboard (admin-gated by @AdminOnly on the controller). Everything here is
// read from the database or from which settings are present; nothing is a placeholder.
export async function dashboardStatsGet(event: HttpEvent) {
  const now = Date.now()
  const dayAgo = new Date(now - DAY_MS)
  const weekAgo = new Date(now - 7 * DAY_MS)

  try {
    const [
      totalEntities,
      activeUsers,
      conversionRevenueSgd,
      conversionRevenueAll,
      latestOfferUpdate,
      openSupport,
      newUsers7d,
      aiPlans24h,
      aiPlans7d,
      affiliateClicks7d,
      latestSupport
    ] = await Promise.all([
      prisma.affiliateEntity.count({ where: { status: 'active' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.affiliateConversionEvent.aggregate({ where: { currency: 'SGD' }, _sum: { commission: true } }),
      prisma.affiliateConversionEvent.aggregate({ _sum: { commission: true } }),
      prisma.affiliateOffer.aggregate({ _max: { updatedAt: true } }),
      prisma.contactMessage.count({ where: { handledAt: null } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.itineraryGeneration.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.itineraryGeneration.count({ where: { createdAt: { gte: weekAgo }, status: 'SUCCESS' } }),
      prisma.affiliateClickEvent.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.contactMessage.findMany({
        where: { handledAt: null },
        orderBy: { createdAt: 'desc' },
        take: 4,
        select: { id: true, name: true, message: true, createdAt: true }
      })
    ])

    const revenue = conversionRevenueSgd._sum.commission ?? conversionRevenueAll._sum.commission ?? 0
    const config = useRuntimeConfig()

    return {
      success: true,
      data: {
        totalEvents: totalEntities,
        activeUsers,
        revenue: Number(revenue) || 0,
        lastScrapeAt: latestOfferUpdate._max.updatedAt,
        attention: {
          support: openSupport
        },
        week: {
          newUsers: newUsers7d,
          aiPlans: aiPlans7d,
          affiliateClicks: affiliateClicks7d
        },
        planner: {
          last24h: aiPlans24h,
          siteDailyLimit: PLANNER_SITE_DAILY_LIMIT
        },
        queue: {
          support: latestSupport.map((item) => ({
            ...item,
            message: item.message.replace(/\s+/g, ' ').slice(0, 140)
          }))
        },
        // Whether each setting is present. Values are never returned.
        config: {
          email: Boolean(config.SMTP_HOST),
          supportInbox: Boolean(config.SELF_BOOKING_NOTIFY_EMAIL || config.SMTP_USER),
          aiPlanner: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)
        }
      }
    }
  } catch (error: any) {
    console.error('Admin dashboard stats fetch error:', error)
    throw createError({ statusCode: 500, message: 'Failed to load dashboard stats' })
  }
}
