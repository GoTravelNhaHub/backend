import { type HttpEvent, createError, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

type ClickRow = {
  provider: string
  placementKey: string | null
  pagePath: string | null
  sessionId: string
  deviceType: string | null
}

function normalizeDevice(deviceType?: string | null): 'mobile' | 'desktop' | 'tablet' | 'unknown' {
  const normalized = String(deviceType || '').toLowerCase()
  if (normalized === 'mobile' || normalized === 'desktop' || normalized === 'tablet') {
    return normalized
  }
  return 'unknown'
}

export async function analyticsAffiliatePerformanceGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const windowMinutes = Math.min(Math.max(parseInt(String(query.window ?? '10080'), 10), 60), 43200)
    const since = new Date(Date.now() - windowMinutes * 60 * 1000)

    const [totalClicks, clicks] = await Promise.all([
      prisma.affiliateClickEvent.count(),
      prisma.affiliateClickEvent.findMany({
        where: { createdAt: { gte: since } },
        select: {
          provider: true,
          placementKey: true,
          pagePath: true,
          sessionId: true,
          deviceType: true
        }
      })
    ])

    const rows = clicks as ClickRow[]
    const windowClicks = rows.length
    const uniqueSessionsSet = new Set(rows.map((row) => row.sessionId))
    const uniqueSessions = uniqueSessionsSet.size

    const providerMap = new Map<string, number>()
    const deviceMap = new Map<string, number>()
    const placementMap = new Map<string, { clicks: number; sessions: Set<string>; pages: Set<string> }>()

    for (const row of rows) {
      const provider = (row.provider || 'unknown').toLowerCase()
      providerMap.set(provider, (providerMap.get(provider) || 0) + 1)

      const device = normalizeDevice(row.deviceType)
      deviceMap.set(device, (deviceMap.get(device) || 0) + 1)

      const placementKey = row.placementKey || 'unknown'
      if (!placementMap.has(placementKey)) {
        placementMap.set(placementKey, { clicks: 0, sessions: new Set<string>(), pages: new Set<string>() })
      }
      const entry = placementMap.get(placementKey)!
      entry.clicks += 1
      entry.sessions.add(row.sessionId)
      if (row.pagePath) entry.pages.add(row.pagePath)
    }

    const providerSplit = Array.from(providerMap.entries())
      .map(([provider, count]) => ({
        provider,
        clicks: count,
        percentage: windowClicks > 0 ? Number(((count / windowClicks) * 100).toFixed(1)) : 0
      }))
      .sort((a, b) => b.clicks - a.clicks)

    const mobileVsDesktop = ['mobile', 'desktop', 'tablet', 'unknown'].map((device) => {
      const clicksForDevice = deviceMap.get(device) || 0
      return {
        device,
        clicks: clicksForDevice,
        percentage: windowClicks > 0 ? Number(((clicksForDevice / windowClicks) * 100).toFixed(1)) : 0
      }
    })

    const topPlacements = Array.from(placementMap.entries())
      .map(([placementKey, stats]) => {
        const placementSessions = stats.sessions.size
        const ctrProxy = uniqueSessions > 0 ? Number(((placementSessions / uniqueSessions) * 100).toFixed(2)) : 0
        return {
          placementKey,
          clicks: stats.clicks,
          uniqueSessions: placementSessions,
          ctrProxy,
          samplePages: Array.from(stats.pages).slice(0, 3)
        }
      })
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 10)

    return {
      success: true,
      data: {
        totals: {
          totalClicks,
          windowClicks,
          uniqueSessions,
          windowMinutes
        },
        providerSplit,
        mobileVsDesktop,
        topPlacements
      }
    }
  } catch (error: any) {
    console.error('Affiliate performance dashboard fetch error:', error)
    throw createError({
      statusCode: error?.statusCode || 500,
      message: 'Failed to fetch affiliate performance dashboard'
    })
  }
}

