import { type HttpEvent, createError, getRouterParam, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'
import { TravellerInputSchema, toTravellerData } from '../services/traveller-input'

export async function idPut(event: HttpEvent) {
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id')
  const parsed = TravellerInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Please enter a name and a valid birth date.' })
  }

  const result = await prisma.traveller.updateMany({
    where: { id, userId: user.id },
    data: toTravellerData(parsed.data)
  })
  if (result.count === 0) {
    throw createError({ statusCode: 404, message: 'Traveller not found.' })
  }
  return { success: true }
}

// Request body schema, used by the controller's Swagger docs
export { TravellerInputSchema as idPutBodySchema }
