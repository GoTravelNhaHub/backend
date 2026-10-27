import { type HttpEvent, createError, readBody } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import nodemailer from 'nodemailer'
import { escapeHtml } from '../../common/utils/email'
import { enforceRateLimit } from '../../common/utils/activity-limits'

const textOf = (value: unknown, max: number) => {
  const raw = typeof value === 'number' && Number.isFinite(value) ? String(value) : typeof value === 'string' ? value : ''
  return raw.replace(/[\r\n]+/g, ' ').trim().slice(0, max)
}

export async function exchange(event: HttpEvent) {
  enforceRateLimit(event.req, 'exchange', 5, 10 * 60 * 1000)

  const body = await readBody(event)
  const config = useRuntimeConfig()
  const name = textOf(body?.name, 100)
  const email = textOf(body?.email, 200)
  const direction = textOf(body?.direction, 40)
  const amount = textOf(body?.amount, 40)
  const converted = textOf(body?.converted, 40)

  if (!name || !email.includes('@') || !amount || !converted) {
    throw createError({ statusCode: 400, statusMessage: 'Missing fields' })
  }

  if (!config.SMTP_USER || !config.SMTP_PASS) {
    throw createError({ statusCode: 500, statusMessage: 'Email service not configured.' })
  }

  const transporter = nodemailer.createTransport({
    host: 'sinult3.hostarmada.net',
    port: 465,
    secure: true,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: true
    }
  })

  try {
    await transporter.sendMail({
      from: 'noreply@enjoytravelsingapore.com',
      to: 'sales@enjoytravelsingapore.com',
      replyTo: email,
      subject: `Currency Exchange Request (${direction || 'unspecified'})`,
      text: `Name: ${name}\nEmail: ${email}\nDirection: ${direction}\nAmount: ${amount}\nConverted: ${converted}`,
      html: `
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Direction:</strong> ${escapeHtml(direction)}</p>
        <p><strong>Amount:</strong> ${escapeHtml(amount)}</p>
        <p><strong>Converted:</strong> ${escapeHtml(converted)}</p>
      `
    })
  } catch (error) {
    console.error('Exchange request email failed:', error)
    throw createError({ statusCode: 500, statusMessage: 'Could not send the exchange request.' })
  }

  return { success: true }
}
