import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

export async function travellersGet(event: HttpEvent) {
  const user = await requireUser(event.req)
  const travellers = await prisma.traveller.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' }
  })
  return { success: true, data: travellers }
}
