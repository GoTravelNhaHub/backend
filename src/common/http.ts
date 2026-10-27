import type { CookieOptions, Request, Response } from 'express'
export { createError } from './http-error'

// Request/response helpers for the route handlers in src/*/handlers. They keep the h3 names
// the handlers were written with (readBody, getQuery, setHeader, ...), on top of Express.
// Controllers build an HttpEvent from @Req()/@Res() and hand it to the handler; `send` writes
// whatever the handler returns.

export interface HttpEvent {
  req: Request
  res: Response
}

export const toEvent = (req: Request, res: Response): HttpEvent => ({ req, res })

/** Parsed body. text/plain bodies (the click beacon) are parsed as JSON when they look like it. */
export async function readBody<T = any>(event: HttpEvent): Promise<T> {
  const body = event.req.body
  if (typeof body === 'string') {
    const trimmed = body.trim()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        // fall through: return the raw text
      }
    }
  }
  return body as T
}

export const getQuery = <T = Record<string, any>>(event: HttpEvent) => event.req.query as T
/** Route parameter. Express 5 types params as string | string[]; routes here only have single segments. */
export function getRouterParam(event: HttpEvent, name: string): string | undefined {
  const value = (event.req.params as Record<string, string | string[] | undefined> | undefined)?.[name]
  return Array.isArray(value) ? value.join('/') : value
}
export const getRouterParams = (event: HttpEvent) => (event.req.params || {}) as Record<string, string>
export const getMethod = (event: HttpEvent) => event.req.method.toUpperCase()

export function getRequestHeader(event: HttpEvent, name: string) {
  const value = event.req.headers[name.toLowerCase()]
  return Array.isArray(value) ? value.join(', ') : value
}
export const getHeader = getRequestHeader
export const getRequestHeaders = (event: HttpEvent) => event.req.headers

export function getRequestIP(event: HttpEvent, _options?: { xForwardedFor?: boolean }) {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() || event.req.socket?.remoteAddress || undefined
}

export const getRequestHost = (event: HttpEvent, _options?: { xForwardedHost?: boolean }) =>
  getRequestHeader(event, 'x-forwarded-host') || getRequestHeader(event, 'host') || ''

export function getRequestURL(event: HttpEvent) {
  const proto = getRequestHeader(event, 'x-forwarded-proto')?.split(',')[0] || event.req.protocol || 'http'
  return new URL(event.req.originalUrl || event.req.url, `${proto}://${getRequestHost(event) || 'localhost'}`)
}

export const getCookie = (event: HttpEvent, name: string): string | undefined => event.req.cookies?.[name]

export function setCookie(event: HttpEvent, name: string, value: string, options: CookieOptions & { maxAge?: number } = {}) {
  // h3 takes maxAge in seconds; Express in milliseconds
  const { maxAge, ...rest } = options
  event.res.cookie(name, value, { ...rest, ...(maxAge !== undefined ? { maxAge: maxAge * 1000 } : {}) })
}

export const deleteCookie = (event: HttpEvent, name: string, options: CookieOptions = {}) => event.res.clearCookie(name, options)

export function setHeader(event: HttpEvent, name: string, value: string | number | readonly string[]) {
  event.res.setHeader(name, value as any)
}
export const setResponseHeader = setHeader

export function setHeaders(event: HttpEvent, headers: Record<string, string | number | readonly string[]>) {
  for (const [name, value] of Object.entries(headers)) event.res.setHeader(name, value as any)
}
export const setResponseHeaders = setHeaders

export const appendHeader = (event: HttpEvent, name: string, value: string) => event.res.append(name, value)

export function setResponseStatus(event: HttpEvent, code: number, _text?: string) {
  event.res.status(code)
}

export function sendRedirect(event: HttpEvent, location: string, code = 302) {
  event.res.redirect(code, location)
}

export function sendNoContent(event: HttpEvent, code = 204) {
  event.res.status(code).end()
}

/** Writes a handler's return value the way h3 did: objects as JSON, strings as text, nothing as 204. */
export async function send(res: Response, result: unknown | Promise<unknown>) {
  const value = await result
  if (res.headersSent || res.writableEnded) return
  if (value === undefined || value === null) {
    if (res.statusCode === 200) res.status(204)
    res.end()
    return
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    res.send(Buffer.from(value))
    return
  }
  if (typeof value === 'string') {
    if (!res.getHeader('content-type')) res.type('html')
    res.send(value)
    return
  }
  res.json(value)
}
