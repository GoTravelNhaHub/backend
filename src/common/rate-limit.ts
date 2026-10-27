import type { Request } from 'express'
import { createError } from './http-error'

// Per-instance limits for anonymous or expensive endpoints. They slow one noisy client; they are
// not a global cap across serverless instances.

const WINDOW_MS = 60 * 1000
const MAX_PER_WINDOW = 120
const hits = new Map<string, number[]>()

/** Client IP, honouring X-Forwarded-For from the platform proxy. */
export function clientIp(req: Request) {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'unknown'
}

export function enforceRateLimit(req: Request, bucket: string, max: number, windowMs: number) {
  const key = `${bucket}:${clientIp(req)}`
  const now = Date.now()
  const recent = (hits.get(key) || []).filter((time) => now - time < windowMs)
  if (recent.length >= max) {
    throw createError({ statusCode: 429, message: 'Too many requests. Please try again later.' })
  }
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 10000) hits.clear()
}

export function enforceActivityRateLimit(req: Request) {
  const ip = clientIp(req)
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((time) => now - time < WINDOW_MS)
  if (recent.length >= MAX_PER_WINDOW) {
    throw createError({ statusCode: 429, message: 'Too many events' })
  }
  recent.push(now)
  hits.set(ip, recent)
  // Keep the map from growing without bound on long-lived instances
  if (hits.size > 10000) hits.clear()
}
