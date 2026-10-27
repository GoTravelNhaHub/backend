import { type HttpEvent, createError, getQuery } from '../../common/http'
import { resolveAffiliateOffers } from '../services/affiliate-offer'

export async function offersGet(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const entityId = query.entityId ? String(query.entityId) : undefined
    const slug = query.slug ? String(query.slug) : undefined
    const placementKey = query.placementKey ? String(query.placementKey) : undefined
    const pagePath = query.pagePath ? String(query.pagePath) : undefined
    const sessionId = query.sessionId ? String(query.sessionId) : undefined

    if (!entityId && !slug) {
      throw createError({
        statusCode: 400,
        message: 'entityId or slug is required'
      })
    }

    return await resolveAffiliateOffers({
      entityId,
      slug,
      placementKey,
      pagePath,
      sessionId
    })
  } catch (error: any) {
    console.error('Affiliate offers resolve error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: 'Failed to resolve affiliate offers'
    })
  }
}

