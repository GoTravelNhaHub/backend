import { type HttpEvent, getQuery, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * GET /api/admin/klook-widgets
 * Get all Klook widgets
 */
export async function klookWidgets(event: HttpEvent) {
  if (event.req.method === 'GET') {
    try {
      const query = getQuery(event)
      const activeOnly = query.activeOnly === 'true'

      const where = activeOnly ? { isActive: true } : {}

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
        error: 'Failed to fetch widgets'
      }
    }
  }

  // POST: Create new widget
  if (event.req.method === 'POST') {
    try {
      const body = await readBody(event)
      
      const widget = await prisma.klookWidget.create({
        data: {
          adId: body.adId,
          name: body.name,
          description: body.description,
          icon: body.icon,
          category: body.category || null,
          widgetType: body.widgetType || 'things_to_do',
          isActive: body.isActive !== undefined ? body.isActive : true,
          displayOrder: body.displayOrder || 0
        }
      })

      return {
        success: true,
        data: widget,
        message: 'Widget created successfully'
      }
    } catch (error: any) {
      console.error('Error creating widget:', error)
      return {
        success: false,
        error: 'Failed to create widget'
      }
    }
  }
}

