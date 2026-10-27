import { useRuntimeConfig } from '../../config/runtime-config'
import { createHmac, timingSafeEqual } from 'crypto'

// Signed unsubscribe links, so knowing an address is not enough to unsubscribe it
const sign = (email: string) =>
  createHmac('sha256', `${useRuntimeConfig().SESSION_PASSWORD || ''}:newsletter`)
    .update(email.trim().toLowerCase())
    .digest('base64url')
    .slice(0, 32)

export const newsletterToken = sign

export const isValidNewsletterToken = (email: string, token: string) => {
  const expected = Buffer.from(sign(email))
  const given = Buffer.from(String(token || ''))
  return expected.length === given.length && timingSafeEqual(expected, given)
}
