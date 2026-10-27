// Guards for the anonymous analytics endpoints (track-activity, affiliate events).
export { enforceActivityRateLimit, enforceRateLimit } from '../rate-limit'

export const clipText = (value: unknown, max: number) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null

/** JSON payloads larger than `max` characters are dropped rather than stored. */
export const boundedJson = (value: unknown, max = 4000) => {
  if (value === null || value === undefined || typeof value !== 'object') return null
  try {
    return JSON.stringify(value).length <= max ? value : null
  } catch {
    return null
  }
}

export const cleanSessionId = (value: unknown) =>
  typeof value === 'string' && /^[A-Za-z0-9_.:-]{4,80}$/.test(value.trim()) ? value.trim() : null
