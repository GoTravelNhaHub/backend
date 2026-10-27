import { type HttpEvent, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { enforceActivityRateLimit, clipText, boundedJson, cleanSessionId } from '../../common/utils/activity-limits'

interface ActivityData {
  sessionId: string
  timestamp: string
  page: string
  action: string
  data?: any
  userAgent?: string
  viewport?: {
    width: number
    height: number
  }
}

export async function trackActivity(event: HttpEvent) {
  enforceActivityRateLimit(event.req)
  try {
    const activity = await readBody(event) as ActivityData
    const userAgentHeader = event.req.headers['user-agent']

    const ipHeader = event.req.headers['x-forwarded-for'] ?? event.req.socket.remoteAddress
    const fallbackSession = Array.isArray(ipHeader) ? ipHeader[0] : typeof ipHeader === 'string' ? ipHeader : null

    const sessionId = cleanSessionId(activity?.sessionId) || fallbackSession || 'anonymous'
    const page = clipText(activity?.page, 300) || 'unknown'
    const action = clipText(activity?.action, 60) || 'view'

    const parsedTimestamp = activity.timestamp ? new Date(activity.timestamp) : new Date()
    const timestamp = Number.isNaN(parsedTimestamp.getTime()) ? new Date() : parsedTimestamp
    const viewportWidth =
      typeof activity.viewport?.width === 'number' ? activity.viewport.width : null
    const viewportHeight =
      typeof activity.viewport?.height === 'number' ? activity.viewport.height : null

    await prisma.userActivity.create({
      data: {
        sessionId,
        timestamp,
        page,
        action,
        data: (boundedJson(activity.data) as any) ?? undefined,
        userAgent: clipText(activity.userAgent ?? (Array.isArray(userAgentHeader) ? userAgentHeader.join(' ') : userAgentHeader), 400),
        viewportWidth,
        viewportHeight
      }
    })

    // Log activity (in production, you'd save to database)
    console.log('📊 User Activity recorded:', {
      session: sessionId,
      page,
      action,
      time: timestamp.toISOString()
    })

    // You can add additional processing here:
    // - Save to database
    // - Update analytics
    // - Store for scraping insights
    // - Trigger data collection if needed

    // Example: Store in memory for now (use database in production)
    // In production, you might want to use Redis, MongoDB, or PostgreSQL
    
    // For scraping insights, you could analyze:
    // - Most clicked hotels/activities
    // - Popular search terms
    // - User flow patterns
    // - Price comparison needs
    
    return {
      success: true,
      message: 'Activity tracked successfully'
    }
  } catch (error) {
    console.error('Error tracking activity:', error)
    return {
      success: false,
      message: 'Failed to track activity'
    }
  }
}
