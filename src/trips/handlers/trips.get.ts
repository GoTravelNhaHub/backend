import { type HttpEvent } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { requireUser } from '../../auth/session'

export async function tripsGet(event: HttpEvent) {
  const user = await requireUser(event.req)
  const trips = await prisma.trip.findMany({
    where: { userId: user.id },
    orderBy: { startDate: 'asc' },
    select: {
      id: true,
      title: true,
      destination: true,
      startDate: true,
      endDate: true,
      party: true,
      createdAt: true
    }
  })
  return { success: true, data: trips }
}
