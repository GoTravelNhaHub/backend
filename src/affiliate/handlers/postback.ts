import { type HttpEvent, createError, getMethod, getQuery, readBody } from '../../common/http'
import { useRuntimeConfig } from '../../config/runtime-config'
import { timingSafeEqual } from 'crypto'
import { parseConversion, upsertConversion } from '../services/affiliate-conversions'

// Partner conversion postback (GET or POST). Configure the partner to call:
//   /api/affiliate/postback?token=<AFFILIATE_POSTBACK_SECRET>&provider=trip&sub_id={sub}&order_id={order}
//     &sale_amount={amount}&commission={commission}&currency={currency}&status={status}
// Without the secret configured the endpoint is disabled.
export async function postback(event: HttpEvent) {
  const method = getMethod(event)
  if (method !== 'GET' && method !== 'POST') {
    throw createError({ statusCode: 405, message: 'Method not allowed' })
  }

  const secret = useRuntimeConfig().AFFILIATE_POSTBACK_SECRET
  if (!secret || secret.length < 16) {
    throw createError({ statusCode: 404, message: 'Not found' })
  }

  const query = getQuery(event)
  const body = method === 'POST' ? ((await readBody(event).catch(() => null)) ?? {}) : {}
  const params = { ...(typeof body === 'object' ? body : {}), ...query } as Record<string, unknown>

  const token = typeof params.token === 'string' ? params.token : ''
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }

  const { token: _token, ...payload } = params
  const parsed = parseConversion(payload)
  if (typeof parsed === 'string') {
    throw createError({ statusCode: 400, message: parsed })
  }

  const outcome = await upsertConversion(parsed)
  return { success: true, outcome }
}
