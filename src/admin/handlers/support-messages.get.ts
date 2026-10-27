import { type HttpEvent, getQuery } from '../../common/http'
import prisma from '../../prisma/prisma.client'

// Contact form inbox (admin-gated by server/middleware/auth-guard.ts). view=open (default) or all.
export async function supportMessagesGet(event: HttpEvent) {
  const query = getQuery(event)
  const view = query.view === 'all' ? 'all' : 'open'
  const messages = await prisma.contactMessage.findMany({
    where: view === 'open' ? { handledAt: null } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200
  })
  return { success: true, view, data: messages }
}
