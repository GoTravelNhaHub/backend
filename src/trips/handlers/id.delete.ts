import { type HttpEvent, createError, getRouterParam } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

export async function idDelete(event: HttpEvent) {
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id')
  const result = await prisma.trip.deleteMany({ where: { id, userId: user.id } })
  if (result.count === 0) {
    throw createError({ statusCode: 404, message: 'Trip not found.' })
  }
  return { success: true }
}
