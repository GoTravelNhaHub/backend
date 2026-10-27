import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import { $fetch } from 'ofetch'
import { createError } from '../common/http-error'
import { useRuntimeConfig } from '../config/runtime-config'

// Keycloak (auth.gotravelnha.com) as seen by this API: the confidential `gotravelnha-web`
// client for browser logins, and the JWKS for verifying Bearer tokens from mobile.

interface Discovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  end_session_endpoint: string
  jwks_uri: string
}

export interface KeycloakClaims extends JWTPayload {
  email?: string
  email_verified?: boolean
  given_name?: string
  family_name?: string
  preferred_username?: string
  picture?: string
  realm_access?: { roles?: string[] }
  nonce?: string
}

let discoveryCache: { issuer: string; value: Promise<Discovery> } | null = null
let jwksCache: { uri: string; jwks: ReturnType<typeof createRemoteJWKSet> } | null = null

export function oidcConfig() {
  const config = useRuntimeConfig()
  const issuer = String(config.OIDC_ISSUER || '').replace(/\/$/, '')
  if (!issuer) throw createError({ statusCode: 500, message: 'Sign-in is not configured.' })
  return {
    issuer,
    clientId: String(config.OIDC_CLIENT_ID),
    clientSecret: String(config.OIDC_CLIENT_SECRET || ''),
    audience: String(config.OIDC_AUDIENCE),
    redirectUri: `${String(config.public.apiUrl).replace(/\/$/, '')}/auth/callback`
  }
}

export function discovery(): Promise<Discovery> {
  const { issuer } = oidcConfig()
  if (discoveryCache?.issuer !== issuer) {
    const value = $fetch<Discovery>(`${issuer}/.well-known/openid-configuration`).catch((error) => {
      discoveryCache = null
      console.error('[oidc] discovery failed:', error)
      throw createError({ statusCode: 503, message: 'Sign-in is unavailable. Try again shortly.' })
    })
    discoveryCache = { issuer, value }
  }
  return discoveryCache.value
}

async function jwks() {
  const { jwks_uri } = await discovery()
  if (jwksCache?.uri !== jwks_uri) jwksCache = { uri: jwks_uri, jwks: createRemoteJWKSet(new URL(jwks_uri)) }
  return jwksCache.jwks
}

const base64url = (buf: Buffer) => buf.toString('base64url')

export function createPkce() {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  return { verifier, challenge }
}

export const randomToken = () => base64url(randomBytes(24))

export async function authorizationUrl(params: { state: string; nonce: string; challenge: string; register?: boolean; locale?: string }) {
  const { clientId, redirectUri } = oidcConfig()
  const { authorization_endpoint } = await discovery()
  const url = new URL(authorization_endpoint)
  url.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    scope: 'openid profile email',
    redirect_uri: redirectUri,
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
    ...(params.register ? { prompt: 'create' } : {}),
    ...(params.locale ? { ui_locales: params.locale } : {})
  }).toString()
  return url.toString()
}

export async function exchangeCode(code: string, verifier: string) {
  const { clientId, clientSecret, redirectUri } = oidcConfig()
  const { token_endpoint } = await discovery()
  return $fetch<{ access_token: string; id_token: string; refresh_token?: string }>(token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: verifier
    }).toString()
  })
}

/** ID token from the code exchange: audience is this client, nonce must match the login attempt. */
export async function verifyIdToken(token: string, nonce: string) {
  const { issuer, clientId } = oidcConfig()
  const { payload } = await jwtVerify<KeycloakClaims>(token, await jwks(), { issuer, audience: clientId })
  if (payload.nonce !== nonce) throw new Error('nonce mismatch')
  return payload
}

/** Access token issued for this API (web or mobile client). Carries realm roles. */
export async function verifyAccessToken(token: string) {
  const { issuer, audience } = oidcConfig()
  const { payload } = await jwtVerify<KeycloakClaims>(token, await jwks(), { issuer, audience })
  return payload
}

export async function endSessionUrl(postLogoutRedirect: string, idToken?: string) {
  const { clientId } = oidcConfig()
  const { end_session_endpoint } = await discovery()
  const url = new URL(end_session_endpoint)
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirect)
  if (idToken) url.searchParams.set('id_token_hint', idToken)
  return url.toString()
}

export const isKeycloakAdmin = (claims: KeycloakClaims) => Boolean(claims.realm_access?.roles?.includes('admin'))
