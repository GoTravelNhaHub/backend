import { type HttpEvent, createError, getRouterParam, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'

// Mark a contact message handled, or reopen it
export async function supportMessagesIdPost(event: HttpEvent) {
  const id = getRouterParam(event, 'id')
  const action = (await readBody(event))?.action
  if (!id || (action !== 'handled' && action !== 'reopen')) {
    throw createError({ statusCode: 400, message: 'Unknown action.' })
  }
  const result = await prisma.contactMessage.updateMany({
    where: { id },
    data: { handledAt: action === 'handled' ? new Date() : null }
  })
  if (result.count === 0) {
    throw createError({ statusCode: 404, message: 'Message not found.' })
  }
  return { success: true }
}
