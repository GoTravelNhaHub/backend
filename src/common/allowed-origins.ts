import { useRuntimeConfig } from '../config/runtime-config'

const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
const isDev = process.env.NODE_ENV !== 'production'

/** Browser origins trusted to call the API with the session cookie: CORS_ORIGINS plus the site and admin URLs. */
export function allowedOrigins() {
  const config = useRuntimeConfig()
  const origins = new Set<string>()
  const add = (value: unknown) => {
    try {
      origins.add(new URL(String(value).trim()).origin)
    } catch {
      // ignore blanks and typos
    }
  }
  String(config.CORS_ORIGINS || '').split(',').forEach(add)
  add(config.public.siteUrl)
  add(config.public.adminUrl)
  return origins
}

export function isAllowedOrigin(origin: string | undefined | null) {
  if (!origin) return false
  if (isDev && LOCAL_ORIGIN.test(origin)) return true
  return allowedOrigins().has(origin)
}

/** Where to send the browser after login/logout. Only our own frontends; anything else falls back to the site. */
export function safeReturnUrl(value: unknown) {
  const fallback = `${String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')}/`
  if (typeof value !== 'string' || !value) return fallback
  try {
    const url = new URL(value)
    return isAllowedOrigin(url.origin) ? url.toString() : fallback
  } catch {
    return fallback
  }
}
