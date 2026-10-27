import { type HttpEvent, createError, readBody } from '../../common/http'
import prisma from '../../prisma/prisma.client'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { isValidNewsletterToken } from '../services/newsletter-token'

export async function unsubscribePost(event: HttpEvent) {
  enforceRateLimit(event.req, 'newsletter-unsubscribe', 10, 10 * 60 * 1000)
  const body = await readBody(event)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
  if (!email || !isValidNewsletterToken(email, body?.token)) {
    throw createError({ statusCode: 400, message: 'This unsubscribe link is not valid. Use the link from your latest email.' })
  }
  await prisma.newsletterSubscriber.updateMany({
    where: { email, isActive: true },
    data: { isActive: false, unsubscribedAt: new Date() }
  })
  return { success: true }
}
