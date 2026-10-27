import { type HttpEvent, readBody } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import prisma from '../../prisma/prisma.client'
import { sendEmail, escapeHtml } from '../../common/utils/email'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { newsletterToken } from '../services/newsletter-token'
import { canonicalSiteOrigin } from '../../shared/utils/site-origin'

/**
 * POST /api/newsletter/subscribe
 * Subscribe to newsletter
 */
export async function subscribe(event: HttpEvent) {
  enforceRateLimit(event.req, 'newsletter', 5, 10 * 60 * 1000)
  try {
    const body = await readBody(event)
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase().slice(0, 200) : ''
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 100) : ''
    const source = typeof body?.source === 'string' ? body.source.trim().slice(0, 40) : 'website'

    if (!email || !email.includes('@')) {
      return {
        success: false,
        error: 'Valid email is required'
      }
    }

    // Check if already subscribed
    const existing = await prisma.newsletterSubscriber.findUnique({
      where: { email: email.toLowerCase() }
    })

    if (existing) {
      if (existing.isActive) {
        return {
          success: true,
          message: "You're already subscribed.",
          alreadySubscribed: true
        }
      } else {
        // Reactivate subscription
        await prisma.newsletterSubscriber.update({
          where: { id: existing.id },
          data: {
            isActive: true,
            subscribedAt: new Date(),
            unsubscribedAt: null
          }
        })
        return {
          success: true,
          message: "Welcome back. You're subscribed again."
        }
      }
    }

    // Create new subscription
    const subscriber = await prisma.newsletterSubscriber.create({
      data: {
        email: email.toLowerCase(),
        name: name || null,
        source: source || 'website',
        isActive: true
      }
    })

    // Send welcome email
    const siteUrl = canonicalSiteOrigin(useRuntimeConfig().public.siteUrl)
    const unsubscribeUrl = `${siteUrl}/newsletter/unsubscribe?email=${encodeURIComponent(email)}&token=${newsletterToken(email)}`
    try {
      await sendEmail({
        to: email,
        subject: 'Welcome to GoTravelNha',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #334155;">
            <h1 style="color: #101D3A;">Welcome to GoTravelNha</h1>
            <p>Thanks for subscribing. We'll send you family trip ideas, school-holiday planning tips and the occasional partner offer from Trip.com or Klook.</p>
            <p><a href="${escapeHtml(siteUrl)}/planner" style="color: #008A9B; font-weight: bold;">Plan a family trip with the AI Travel Agent</a></p>
            <hr style="border: none; border-top: 1px solid #E2E8F0;">
            <p style="font-size: 12px; color: #64748B;">
              <a href="${escapeHtml(unsubscribeUrl)}" style="color: #64748B;">Unsubscribe</a>
            </p>
          </div>
        `
      })
    } catch (emailError) {
      console.error('Error sending welcome email:', emailError)
      // Don't fail subscription if email fails
    }

    return {
      success: true,
      message: "You're subscribed. Watch your inbox for family trip ideas."
    }
  } catch (error: any) {
    console.error('Newsletter subscription error:', error)
    if (error?.statusCode === 429) throw error
    return {
      success: false,
      error: 'Failed to subscribe. Please try again.'
    }
  }
}

