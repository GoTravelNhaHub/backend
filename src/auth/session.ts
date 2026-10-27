import { createHash } from 'node:crypto'
import type { CookieOptions, Request, Response } from 'express'
import { EncryptJWT, jwtDecrypt } from 'jose'
import prisma from '../prisma/prisma.client'
import { createError } from '../common/http-error'
import { useRuntimeConfig } from '../config/runtime-config'
import { isKeycloakAdmin, verifyAccessToken, type KeycloakClaims } from './oidc'

// Two ways in, one user:
// - Browsers (www, admin): encrypted `gotravelnha_session` cookie set by /auth/callback after a
//   Keycloak login. Its domain is SESSION_COOKIE_DOMAIN (.gotravelnha.com), so www, admin and
//   api all see it.
// - Mobile and other API clients: `Authorization: Bearer <Keycloak access token>` (aud gotravelnha-api).

export const SESSION_COOKIE = 'gotravelnha_session'
export const LOGIN_COOKIE = 'gotravelnha_login'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

export interface AuthSessionData {
  userId?: string
  /** Keycloak ID token, sent back as id_token_hint on logout */
  idToken?: string
}

export interface LoginState {
  state: string
  nonce: string
  verifier: string
  redirect: string
  /** Referral code from ?ref= on the register link */
  ref?: string
}

function sessionKey() {
  const password = useRuntimeConfig().SESSION_PASSWORD
  if (!password || password.length < 32) {
    console.error('SESSION_PASSWORD is missing or shorter than 32 characters.')
    throw createError({ statusCode: 500, message: 'Session is not configured.' })
  }
  return createHash('sha256').update(password).digest()
}

function cookieOptions(maxAgeSeconds: number, shared: boolean): CookieOptions {
  const domain = shared ? useRuntimeConfig().SESSION_COOKIE_DOMAIN || undefined : undefined
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    domain,
    maxAge: maxAgeSeconds * 1000
  }
}

async function seal(payload: Record<string, unknown>, maxAgeSeconds: number) {
  return new EncryptJWT(payload)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .encrypt(sessionKey())
}

async function unseal<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null
  try {
    const { payload } = await jwtDecrypt(token, sessionKey())
    return payload as T
  } catch {
    return null
  }
}

export async function setAuthSession(res: Response, userId: string, idToken?: string) {
  res.cookie(SESSION_COOKIE, await seal({ userId, idToken }, SESSION_MAX_AGE), cookieOptions(SESSION_MAX_AGE, true))
}

/** Clears the session and returns the ID token it held (for Keycloak logout). */
export async function clearAuthSession(req: Request, res: Response) {
  const data = await unseal<AuthSessionData>(req.cookies?.[SESSION_COOKIE])
  const { maxAge, ...options } = cookieOptions(0, true)
  res.clearCookie(SESSION_COOKIE, options)
  return data?.idToken
}

/** Short-lived cookie that carries state, nonce and PKCE verifier from /auth/login to /auth/callback. */
export async function setLoginState(res: Response, state: LoginState) {
  res.cookie(LOGIN_COOKIE, await seal({ ...state }, 10 * 60), cookieOptions(10 * 60, false))
}

export async function takeLoginState(req: Request, res: Response) {
  const data = await unseal<LoginState>(req.cookies?.[LOGIN_COOKIE])
  const { maxAge, ...options } = cookieOptions(0, false)
  res.clearCookie(LOGIN_COOKIE, options)
  return data
}

export const userSelect = {
  id: true,
  username: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true
} as const

export interface AuthUser {
  id: string
  username: string
  email: string
  firstName: string | null
  lastName: string | null
  role: 'ADMIN' | 'USER'
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

async function uniqueUsername(email: string, preferred?: string) {
  const base =
    (preferred && !preferred.includes('@') ? preferred : email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .slice(0, 30) || 'traveller'
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`
    if (!(await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } }))) return candidate
  }
  return `${base}${Date.now()}`
}

/**
 * Local User row for a Keycloak identity. Looks up by `keycloakId` (the token `sub`); the first time,
 * links an existing row with the same verified email, or creates one. Keycloak owns the admin role
 * (realm role `admin`, granted by the `gotravelnha-admins` group), so `role` follows the token.
 */
export async function userFromClaims(claims: KeycloakClaims): Promise<AuthUser> {
  const sub = claims.sub
  const email = claims.email?.trim().toLowerCase()
  if (!sub || !email) throw createError({ statusCode: 401, message: 'Your account has no email address.' })

  const role = isKeycloakAdmin(claims) ? 'ADMIN' : 'USER'
  let user = await prisma.user.findUnique({ where: { keycloakId: sub } })
  if (!user && claims.email_verified) {
    user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, keycloakId: null } })
  }

  if (!user) {
    return prisma.user.create({
      data: {
        keycloakId: sub,
        email,
        username: await uniqueUsername(email, claims.preferred_username),
        firstName: claims.given_name || null,
        lastName: claims.family_name || null,
        providerImage: claims.picture || null,
        provider: 'keycloak',
        role
      },
      select: userSelect
    })
  }

  const changes: Record<string, unknown> = {}
  if (user.keycloakId !== sub) changes.keycloakId = sub
  if (user.role !== role) changes.role = role
  if (user.email !== email && claims.email_verified) changes.email = email
  if (!user.firstName && claims.given_name) changes.firstName = claims.given_name
  if (!user.lastName && claims.family_name) changes.lastName = claims.family_name
  if (Object.keys(changes).length) {
    return prisma.user.update({ where: { id: user.id }, data: changes, select: userSelect })
  }
  const { id, username, firstName, lastName, isActive, createdAt, updatedAt } = user
  return { id, username, email: user.email, firstName, lastName, role: user.role, isActive, createdAt, updatedAt }
}

async function bearerUser(req: Request) {
  const token = req.headers.authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return undefined

  let claims: KeycloakClaims
  try {
    claims = await verifyAccessToken(token)
  } catch {
    throw createError({ statusCode: 401, message: 'Your sign-in has expired. Please sign in again.' })
  }
  const user = await userFromClaims(claims)
  return user.isActive ? user : null
}

type RequestWithUser = Request & { authUser?: AuthUser | null }

/** Signed-in user (Bearer token or session cookie), re-read from the DB so role and isActive are current. Cached per request. */
export async function getSessionUser(req: Request): Promise<AuthUser | null> {
  const cachedReq = req as RequestWithUser
  if (cachedReq.authUser !== undefined) return cachedReq.authUser

  let user = await bearerUser(req)
  if (user === undefined) {
    const session = await unseal<AuthSessionData>(req.cookies?.[SESSION_COOKIE])
    const row = session?.userId ? await prisma.user.findUnique({ where: { id: session.userId }, select: userSelect }) : null
    user = row?.isActive ? row : null
  }

  cachedReq.authUser = user
  return user
}

export async function requireUser(req: Request) {
  const user = await getSessionUser(req)
  if (!user) {
    throw createError({ statusCode: 401, message: 'Please sign in.' })
  }
  return user
}

export async function requireAdmin(req: Request) {
  const user = await requireUser(req)
  if (user.role !== 'ADMIN') {
    throw createError({ statusCode: 403, message: 'Admin access required.' })
  }
  return user
}
