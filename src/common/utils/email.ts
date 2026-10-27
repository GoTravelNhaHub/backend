import { useRuntimeConfig } from '../../config/runtime-config'
import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type { SecureVersion } from 'tls'

let transporter: Transporter | null = null

/**
 * Initialize email transporter (singleton pattern)
 */
const getTransporter = (): Transporter | null => {
  const config = useRuntimeConfig()
  
  if (!config.SMTP_USER || !config.SMTP_PASS) {
    console.warn('SMTP credentials not configured. Email functionality disabled.')
    return null
  }

  const port = parseInt(config.SMTP_PORT as string, 10) || 587
  const allowSecure = config.SMTP_SECURE === 'true'
  const allowStartTls = config.SMTP_REQUIRE_STARTTLS !== 'false'
  const explicitSecure = allowSecure || port === 465

  if (!transporter) {
    const smtpOptions: SMTPTransport.Options = {
      host: config.SMTP_HOST || 'smtp.gmail.com',
      port,
      secure: explicitSecure,
      requireTLS: !explicitSecure && allowStartTls,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: true,
        minVersion: typeof config.SMTP_TLS_MIN_VERSION === 'string'
          ? config.SMTP_TLS_MIN_VERSION as SecureVersion
          : undefined,
        ciphers: typeof config.SMTP_TLS_CIPHERS === 'string' ? config.SMTP_TLS_CIPHERS : undefined
      }
    }
    transporter = nodemailer.createTransport(smtpOptions)
  }

  return transporter
}

/**
 * Send email utility
 */
export const sendEmail = async (options: {
  to: string | string[]
  subject: string
  html?: string
  text?: string
  from?: string
  replyTo?: string
  cc?: string | string[]
}): Promise<void> => {
  const transporter = getTransporter()
  
  if (!transporter) {
    throw new Error('SMTP not configured. Cannot send email.')
  }

  const config = useRuntimeConfig()
  const defaultFrom = `GoTravelNha <${config.SMTP_USER}>`

  try {
    await transporter.sendMail({
      from: options.from || defaultFrom,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      replyTo: options.replyTo,
      cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html?.replace(/<[^>]*>/g, '') // Strip HTML for text version
    })
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}


/** Escape user-supplied text before putting it in an HTML email. */
export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
