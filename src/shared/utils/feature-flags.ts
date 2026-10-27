/** Reads an env-style flag ('true', 'off', '0', ...). Missing or blank values use `fallback`. */
export const flagEnabled = (value: unknown, fallback: boolean) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string' || !value.trim()) return fallback
  return !['false', '0', 'off', 'no'].includes(value.trim().toLowerCase())
}

/** Community pages, APIs and nav item (NUXT_PUBLIC_ENABLE_COMMUNITY). Off unless turned on. */
export const communityEnabled = (publicConfig: { enableCommunity?: unknown } | undefined) =>
  flagEnabled(publicConfig?.enableCommunity, false)

/**
 * Labelled sample trips and creators on /community (NUXT_PUBLIC_COMMUNITY_DEMO), for design
 * review while there are few real trips. Off unless turned on; never turn it on in production.
 */
export const communityDemoEnabled = (publicConfig: { communityDemo?: unknown } | undefined) =>
  flagEnabled(publicConfig?.communityDemo, false)
