import { type HttpEvent, createError, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'
import { TravellerInputSchema, toTravellerData } from '../services/traveller-input'

const MAX_TRAVELLERS = 12

export async function travellersPost(event: HttpEvent) {
  const user = await requireUser(event.req)
  const parsed = TravellerInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Please enter a name and a valid birth date.' })
  }

  if ((await prisma.traveller.count({ where: { userId: user.id } })) >= MAX_TRAVELLERS) {
    throw createError({ statusCode: 400, message: `You can save up to ${MAX_TRAVELLERS} travellers.` })
  }

  const traveller = await prisma.traveller.create({
    data: { userId: user.id, ...toTravellerData(parsed.data) }
  })
  return { success: true, data: traveller }
}

// Request body schema, used by the controller's Swagger docs
export { TravellerInputSchema as travellersPostBodySchema }
