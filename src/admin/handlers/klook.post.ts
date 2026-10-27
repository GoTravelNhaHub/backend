import { type HttpEvent, createError, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

interface UpdateEventPayload {
  id: string
  isActive?: boolean
  isPublished?: boolean
  publishedAt?: string | Date | null
  publicPrice?: number | null
  notes?: string | null
  isSelfBookable?: boolean
  stripePriceId?: string | null
  checkoutNotes?: string | null
}

export async function klookPost(event: HttpEvent) {
  try {
    const body = (await readBody(event)) as UpdateEventPayload[]

    if (!Array.isArray(body) || body.length === 0) {
      throw createError({
        statusCode: 400,
        message: 'Payload must be a non-empty array'
      })
    }

    const updates = body.map((item) => {
      if (!item.id) {
        throw createError({
          statusCode: 400,
          message: 'Each item must include an id'
        })
      }

      const data: any = {}
      if (typeof item.isActive === 'boolean') {
        data.isActive = item.isActive
      }

      return prisma.affiliateOffer.update({
        where: { id: item.id },
        data,
        include: {
          entity: true
        }
      })
    })

    const updatedEvents = await prisma.$transaction(updates)

    return {
      success: true,
      updated: updatedEvents.length,
      data: updatedEvents
    }
  } catch (error: any) {
    console.error('Admin Klook events update error:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      message: 'Failed to update Klook events'
    })
  }
}
