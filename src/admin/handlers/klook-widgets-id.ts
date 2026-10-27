import { type HttpEvent, getRouterParam, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

/**
 * PUT/DELETE /api/admin/klook-widgets/[id]
 * Update or delete a Klook widget
 */
export async function klookWidgetsId(event: HttpEvent) {
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw new Error('Widget ID is required')
  }

  // PUT: Update widget
  if (event.req.method === 'PUT') {
    try {
      const body = await readBody(event)

      const widget = await prisma.klookWidget.update({
        where: { id },
        data: {
          adId: body.adId,
          name: body.name,
          description: body.description,
          icon: body.icon,
          category: body.category || null,
          widgetType: body.widgetType || 'things_to_do',
          isActive: body.isActive,
          displayOrder: body.displayOrder || 0
        }
      })

      return {
        success: true,
        data: widget,
        message: 'Widget updated successfully'
      }
    } catch (error: any) {
      console.error('Error updating widget:', error)
      return {
        success: false,
        error: 'Failed to update widget'
      }
    }
  }

  // DELETE: Delete widget
  if (event.req.method === 'DELETE') {
    try {
      await prisma.klookWidget.delete({
        where: { id }
      })

      return {
        success: true,
        message: 'Widget deleted successfully'
      }
    } catch (error: any) {
      console.error('Error deleting widget:', error)
      return {
        success: false,
        error: 'Failed to delete widget'
      }
    }
  }
}

