import { type HttpEvent, createError, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function analyticsActivitiesGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const limit = Math.min(parseInt(String(query.limit ?? '50'), 10), 200)
    const windowMinutes = Math.min(Math.max(parseInt(String(query.window ?? '60'), 10), 5), 1440)
    const since = new Date(Date.now() - windowMinutes * 60 * 1000)

    const [totalActivities, uniqueSessionGroups, activeSessionGroups, recentActivities, windowActivities, topPages, topActions] =
      await Promise.all([
        prisma.userActivity.count(),
        prisma.userActivity.groupBy({
          by: ['sessionId'],
          _count: { sessionId: true }
        }),
        prisma.userActivity.groupBy({
          by: ['sessionId'],
          where: {
            timestamp: { gte: since }
          },
          _count: { sessionId: true }
        }),
        prisma.userActivity.findMany({
          orderBy: { timestamp: 'desc' },
          take: limit
        }),
        prisma.userActivity.findMany({
          where: { timestamp: { gte: since } },
          orderBy: { timestamp: 'asc' },
          take: 1000
        }),
        prisma.userActivity.groupBy({
          by: ['page'],
          where: { timestamp: { gte: since } },
          _count: { page: true },
          orderBy: [{ _count: { page: 'desc' } }],
          take: 5
        }),
        prisma.userActivity.groupBy({
          by: ['action'],
          where: { timestamp: { gte: since } },
          _count: { action: true },
          orderBy: [{ _count: { action: 'desc' } }],
          take: 5
        })
      ])

    const timelineMap = new Map<string, number>()
    windowActivities.forEach((activity) => {
      const key = new Date(activity.timestamp).toISOString().slice(0, 16) // minute precision
      timelineMap.set(key, (timelineMap.get(key) ?? 0) + 1)
    })

    const timeline = Array.from(timelineMap.entries()).map(([time, count]) => ({
      time,
      count
    }))

    return {
      success: true,
      data: {
        totals: {
          totalActivities,
          uniqueSessions: uniqueSessionGroups.length,
          activeSessions: activeSessionGroups.length,
          windowMinutes
        },
        topPages: topPages.map((item) => ({
          page: item.page,
          count: item._count.page
        })),
        topActions: topActions.map((item) => ({
          action: item.action,
          count: item._count.action
        })),
        timeline,
        recent: recentActivities.map((activity) => ({
          id: activity.id,
          sessionId: activity.sessionId,
          page: activity.page,
          action: activity.action,
          timestamp: activity.timestamp,
          userAgent: activity.userAgent,
          viewportWidth: activity.viewportWidth,
          viewportHeight: activity.viewportHeight,
          data: activity.data
        }))
      }
    }
  } catch (error: any) {
    console.error('Admin analytics fetch error:', error)
    throw createError({
      statusCode: 500,
      message: 'Failed to load analytics'
    })
  }
}

