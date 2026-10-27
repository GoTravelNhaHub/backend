import { type HttpEvent, createError, readBody } from '../../common/http'
import type { Prisma } from '@prisma/client'
import prisma from '../../prisma/prisma.client'
import { buildAffiliateLink } from '../services/affiliate-link'
import { getSessionUser } from '../../auth/session'
import { readAttribution, readVisitorSession } from '../../common/utils/attribution'
import { isApprovedPartnerUrl, publicClickMetadata } from '../../shared/utils/partner-url'

interface AffiliateClickBody {
  offerId?: string
  entityId?: string
  provider?: string
  baseUrl?: string
  placementKey?: string
  pagePath?: string
  sessionId?: string
  referrer?: string
  metadata?: Record<string, any>
}

function detectDeviceType(userAgent: string): string {
  const ua = userAgent.toLowerCase()
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) return 'tablet'
  if (ua.includes('mobile') || ua.includes('iphone') || ua.includes('android')) return 'mobile'
  if (!ua) return 'unknown'
  return 'desktop'
}

export async function clickPost(event: HttpEvent) {
  try {
    const body = (await readBody(event)) as AffiliateClickBody
    const uaHeader = event.req.headers['user-agent']
    const userAgent = Array.isArray(uaHeader) ? uaHeader.join(' ') : String(uaHeader || '')

    let offer = null as any
    let baseUrl = body.baseUrl || ''
    let provider = body.provider || ''
    let entityId = body.entityId || null

    if (body.offerId) {
      offer = await prisma.affiliateOffer.findUnique({
        where: { id: body.offerId },
        select: {
          id: true,
          entityId: true,
          provider: true,
          baseUrl: true,
          isActive: true
        }
      })

      if (!offer || !offer.isActive) {
        throw createError({ statusCode: 404, message: 'Offer not found or inactive' })
      }

      baseUrl = offer.baseUrl
      provider = offer.provider
      entityId = offer.entityId
    }

    if (!baseUrl || !provider) {
      throw createError({
        statusCode: 400,
        message: 'offerId or (provider + baseUrl) is required'
      })
    }

    if (!isApprovedPartnerUrl(baseUrl)) {
      throw createError({ statusCode: 400, message: 'Unsupported partner link' })
    }

    const sessionUser = await getSessionUser(event.req).catch(() => null)
    const clientMetadata = publicClickMetadata(body.metadata)
    const attribution = readAttribution(event.req)
    const metadata = clientMetadata || attribution ? { ...clientMetadata, ...(attribution ? { attribution } : {}) } : null
    const sessionId = body.sessionId || readVisitorSession(event.req) || 'anonymous'

    const { url: outboundUrl, subId } = buildAffiliateLink({
      provider,
      baseUrl,
      context: {
        entityId: entityId || undefined,
        offerId: offer?.id,
        placementKey: body.placementKey,
        pagePath: body.pagePath,
        sessionId
      }
    })

    const placement = body.placementKey
      ? await prisma.affiliatePlacement.findUnique({
          where: { key: body.placementKey },
          select: { id: true }
        })
      : null

    const click = await prisma.affiliateClickEvent.create({
      data: {
        sessionId,
        userId: sessionUser?.id ?? null,
        entityId,
        offerId: offer?.id || null,
        provider,
        placementKey: body.placementKey || null,
        placementId: placement?.id || null,
        pagePath: body.pagePath || null,
        referrer: body.referrer || null,
        deviceType: detectDeviceType(userAgent),
        subId,
        outboundUrl,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined
      }
    })

    return {
      success: true,
      clickId: click.id,
      subId,
      outboundUrl
    }
  } catch (error: any) {
    if (error?.statusCode && error.statusCode < 500) throw error
    console.error('Affiliate click tracking error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: 'Failed to track affiliate click'
    })
  }
}

