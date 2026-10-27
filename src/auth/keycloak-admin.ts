import { $fetch } from 'ofetch'
import prisma from '../prisma/prisma.client'
import { createError } from '../common/http-error'
import { useRuntimeConfig } from '../config/runtime-config'
import { discovery, oidcConfig } from './oidc'

// Keycloak Admin REST API through the `iam-admin` service account
// (realm-management: manage-users, view-users, query-users, query-groups).
// Keycloak owns passwords and the admin role; the local User row keeps `keycloakId`.

const ADMIN_GROUP = 'gotravelnha-admins'

let tokenCache: { token: string; expiresAt: number } | null = null
let adminGroupId: string | null = null

function adminBase() {
  // https://auth.gotravelnha.com/realms/gotravelnha → https://auth.gotravelnha.com/admin/realms/gotravelnha
  return oidcConfig().issuer.replace('/realms/', '/admin/realms/')
}

async function adminToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token
  const config = useRuntimeConfig()
  if (!config.KEYCLOAK_ADMIN_CLIENT_SECRET) {
    throw createError({ statusCode: 500, message: 'Account management is not configured.' })
  }
  const { token_endpoint } = await discovery()
  const res = await $fetch<{ access_token: string; expires_in: number }>(token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: String(config.KEYCLOAK_ADMIN_CLIENT_ID),
      client_secret: String(config.KEYCLOAK_ADMIN_CLIENT_SECRET)
    }).toString()
  })
  tokenCache = { token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 }
  return res.access_token
}

async function kc<T = unknown>(path: string, options: { method?: string; body?: unknown; query?: Record<string, string> } = {}): Promise<T> {
  return $fetch<T>(`${adminBase()}${path}`, {
    method: (options.method || 'GET') as any,
    body: options.body as any,
    query: options.query,
    headers: { authorization: `Bearer ${await adminToken()}` }
  }) as Promise<T>
}

interface KcUser {
  id: string
  email?: string
  firstName?: string
  lastName?: string
}

export async function findKeycloakUserByEmail(email: string): Promise<KcUser | null> {
  const users = await kc<KcUser[]>('/users', { query: { email, exact: 'true' } })
  return users[0] || null
}

/** Finds the Keycloak user with this email or creates one (verified, no password yet). Returns its id. */
export async function ensureKeycloakUser(input: { email: string; firstName?: string | null; lastName?: string | null }): Promise<string> {
  const email = input.email.trim().toLowerCase()
  const existing = await findKeycloakUserByEmail(email)
  if (existing) return existing.id

  await kc('/users', {
    method: 'POST',
    body: {
      username: email,
      email,
      emailVerified: true,
      enabled: true,
      firstName: input.firstName || undefined,
      lastName: input.lastName || undefined
    }
  })
  const created = await findKeycloakUserByEmail(email)
  if (!created) throw createError({ statusCode: 502, message: 'Could not create the account.' })
  return created.id
}

/** Keycloak id for a local user, creating and linking the Keycloak account if the row has none. */
export async function keycloakIdFor(user: { id: string; email: string; firstName?: string | null; lastName?: string | null; keycloakId?: string | null }) {
  if (user.keycloakId) return user.keycloakId
  const keycloakId = await ensureKeycloakUser(user)
  await prisma.user.update({ where: { id: user.id }, data: { keycloakId } })
  return keycloakId
}

/** Emails the user a Keycloak link to set a password. Link lasts `lifespanSeconds`. */
export async function sendSetPasswordEmail(keycloakId: string, lifespanSeconds = 60 * 60 * 24 * 3) {
  await kc(`/users/${keycloakId}/execute-actions-email`, {
    method: 'PUT',
    query: { client_id: oidcConfig().clientId, lifespan: String(lifespanSeconds) },
    body: ['UPDATE_PASSWORD']
  })
}

export async function setKeycloakPassword(keycloakId: string, password: string, temporary: boolean) {
  await kc(`/users/${keycloakId}/reset-password`, {
    method: 'PUT',
    body: { type: 'password', value: password, temporary }
  })
}

export async function updateKeycloakProfile(keycloakId: string, changes: { email?: string; firstName?: string | null; lastName?: string | null }) {
  const body: Record<string, unknown> = {}
  if (changes.email) Object.assign(body, { email: changes.email, username: changes.email, emailVerified: true })
  if (changes.firstName !== undefined) body.firstName = changes.firstName || ''
  if (changes.lastName !== undefined) body.lastName = changes.lastName || ''
  if (Object.keys(body).length) await kc(`/users/${keycloakId}`, { method: 'PUT', body })
}

async function getAdminGroupId() {
  if (adminGroupId) return adminGroupId
  const groups = await kc<{ id: string; name: string }[]>('/groups', { query: { search: ADMIN_GROUP, exact: 'true' } })
  const group = groups.find((g) => g.name === ADMIN_GROUP)
  if (!group) throw createError({ statusCode: 500, message: `Keycloak group ${ADMIN_GROUP} is missing.` })
  adminGroupId = group.id
  return group.id
}

/** Grants or removes the `admin` realm role through the gotravelnha-admins group. */
export async function setKeycloakAdmin(keycloakId: string, admin: boolean) {
  const groupId = await getAdminGroupId()
  await kc(`/users/${keycloakId}/groups/${groupId}`, { method: admin ? 'PUT' : 'DELETE' })
}
