import { type HttpEvent, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

// Admin user list (admin-gated by server/middleware/auth-guard.ts)
export async function users(event: HttpEvent) {
  const query = getQuery(event)

  // Get all users or filtered users
  const users = await prisma.user.findMany({
    where: query.role ? { role: query.role as any } : undefined,
    select: {
      id: true,
      username: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      provider: true,
      // What deleting the account would remove or unlink
      _count: { select: { trips: true, travellers: true, loyaltyPoints: true } }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return {
    success: true,
    users
  }
}

