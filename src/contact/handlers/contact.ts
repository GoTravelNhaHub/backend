import { type HttpEvent, createError, getRequestIP, readBody } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'
import { sendEmail, escapeHtml } from '../../common/utils/email'
import { getSessionUser } from '../../auth/session'

const ContactSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().max(200),
  message: z.string().trim().min(5).max(5000)
})

// Per-instance limit. Serverless instances don't share it, so it slows a single
// sender down rather than guaranteeing a global cap.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 5
const recent = new Map<string, number[]>()

export async function contact(event: HttpEvent) {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  const now = Date.now()
  const hits = (recent.get(ip) || []).filter((time) => now - time < WINDOW_MS)
  if (hits.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, message: 'Too many messages. Please try again later.' })
  }

  const parsed = ContactSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Please enter your name, a valid email and a message.' })
  }
  const { name, email, message } = parsed.data

  hits.push(now)
  recent.set(ip, hits)

  // Saved first, so the message reaches Admin → Support even if email fails
  const user = await getSessionUser(event.req).catch(() => null)
  const saved = await prisma.contactMessage.create({
    data: { name, email, message, userId: user?.id ?? null }
  })

  const config = useRuntimeConfig()
  const to = config.SELF_BOOKING_NOTIFY_EMAIL || config.SMTP_USER
  if (!to) {
    console.error('[contact] No support inbox configured; message saved only:', saved.id)
    return { success: true }
  }

  try {
    // Sent from our own address so it passes SPF/DMARC; replies go to the customer
    await sendEmail({
      to,
      replyTo: email,
      subject: `New contact message from ${name.replace(/[\r\n]+/g, ' ')}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html: `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`
    })
    await prisma.contactMessage.update({ where: { id: saved.id }, data: { emailedAt: new Date() } })
  } catch (error) {
    // The message is saved; staff see it in Admin → Support
    console.error('[contact] Failed to email message:', saved.id, error)
  }

  return { success: true }
}

// Request body schema, used by the controller's Swagger docs
export { ContactSchema as contactBodySchema }
