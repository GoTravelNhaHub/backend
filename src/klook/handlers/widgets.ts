import { type HttpEvent, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * GET /api/klook/widgets
 * Get active Klook widgets for public display
 */
export async function widgets(event: HttpEvent) {
  try {
    const query = getQuery(event)
    const widgetType = query.widgetType as string | undefined // 'things_to_do' or 'hotels'

    const where: any = {
      isActive: true
    }

    if (widgetType) {
      where.widgetType = widgetType
    }

    const widgets = await prisma.klookWidget.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return {
      success: true,
      data: widgets,
      count: widgets.length
    }
  } catch (error: any) {
    console.error('Error fetching Klook widgets:', error)
    return {
      success: false,
      error: 'Failed to fetch widgets',
      data: []
    }
  }
}

