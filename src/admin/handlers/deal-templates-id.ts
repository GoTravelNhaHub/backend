import { type HttpEvent, getRouterParam, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

export async function dealTemplatesId(event: HttpEvent) {
  const id = getRouterParam(event, 'id')
  if (!id) {
    return { success: false, error: 'Template ID is required' }
  }

  if (event.req.method === 'PUT') {
    try {
      const body = await readBody(event)
      const updated = await prisma.dealTemplate.update({
        where: { id },
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
        data: updated
      }
    } catch (error: any) {
      console.error('Failed to update deal template:', error)
      return {
        success: false,
        error: 'Failed to update template'
      }
    }
  }

  if (event.req.method === 'DELETE') {
    try {
      await prisma.dealTemplate.delete({ where: { id } })
      return {
        success: true
      }
    } catch (error: any) {
      console.error('Failed to delete deal template:', error)
      return {
        success: false,
        error: 'Failed to delete template'
      }
    }
  }

  return {
    success: false,
    error: 'Method not allowed'
  }
}

