import { type HttpEvent, createError, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

interface SlotPayload {
  id?: string
  title: string
  provider: 'trip' | 'klook'
  category: string
  destination?: string
  description?: string
  baseUrl: string
  isActive?: boolean
  priority?: number
}

function toSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function affiliateSlotsPost(event: HttpEvent) {
  try {
    const body = (await readBody(event)) as SlotPayload
    if (!body?.title || !body?.provider || !body?.category || !body?.baseUrl) {
      throw createError({
        statusCode: 400,
        message: 'title, provider, category and baseUrl are required'
      })
    }

    const provider = body.provider === 'trip' ? 'trip' : 'klook'
    const destination = String(body.destination || 'global').toLowerCase().trim() || 'global'
    const baseSlug = toSlug(`${body.title}-${provider}-${destination}`)
    const slug = body.id ? undefined : `${baseSlug}-${Date.now().toString(36).slice(-5)}`

    const slot = body.id
      ? await prisma.affiliateOffer.findUnique({
          where: { id: body.id },
          include: { entity: true }
        })
      : null

    const entityId = slot?.entityId
      ? slot.entityId
      : (
          await prisma.affiliateEntity.create({
            data: {
              slug: slug || toSlug(`${body.title}-${provider}`),
              title: body.title,
              category: body.category,
              location: destination === 'global' ? null : destination,
              status: 'active',
              metadata: {
                managedBy: 'deal-slot-manager'
              }
            }
          })
        ).id

    await prisma.affiliateEntity.update({
      where: { id: entityId },
      data: {
        title: body.title,
        category: body.category,
        location: destination === 'global' ? null : destination,
        status: 'active'
      }
    })

    const metadata = {
      dealSlot: true,
      destination,
      description: body.description || '',
      priority: Number(body.priority || 0) || 0,
      managedBy: 'deal-slot-manager'
    }

    const result = slot
      ? await prisma.affiliateOffer.update({
          where: { id: slot.id },
          data: {
            provider,
            baseUrl: body.baseUrl,
            affiliateUrl: body.baseUrl,
            isActive: body.isActive !== false,
            availabilityStatus: 'available',
            lastVerifiedAt: new Date(),
            metadata
          },
          include: { entity: true }
        })
      : await prisma.affiliateOffer.create({
          data: {
            entityId,
            provider,
            baseUrl: body.baseUrl,
            affiliateUrl: body.baseUrl,
            isActive: body.isActive !== false,
            availabilityStatus: 'available',
            lastVerifiedAt: new Date(),
            currency: 'SGD',
            metadata
          },
          include: { entity: true }
        })

    return {
      success: true,
      data: result
    }
  } catch (error: any) {
    console.error('Failed to save affiliate slot:', error)
    throw createError({
      statusCode: error?.statusCode || 500,
      message: 'Failed to save affiliate slot'
    })
  }
}
