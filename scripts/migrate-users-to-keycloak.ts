/**
 * Move GoTravelNha users into Keycloak (auth.gotravelnha.com).
 *
 * For every active User without `keycloakId`:
 *   1. find the Keycloak user with the same email, or create one (emailVerified, no password)
 *   2. save its id in User.keycloakId
 *   3. ADMIN users join the `gotravelnha-admins` group (realm role `admin`)
 *   4. with --send-emails, users who had a local password get Keycloak's "set your password" email
 *      (Google-only users just sign in with Google again; Keycloak links the account by email)
 *
 * Dry run by default. Needs DATABASE_URL, OIDC_ISSUER, KEYCLOAK_ADMIN_CLIENT_ID, KEYCLOAK_ADMIN_CLIENT_SECRET.
 *   npm run users:migrate-to-keycloak                         # report only
 *   npm run users:migrate-to-keycloak -- --apply              # create and link
 *   npm run users:migrate-to-keycloak -- --apply --send-emails
 */
import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const apply = process.argv.includes('--apply')
const sendEmails = process.argv.includes('--send-emails')
const issuer = (process.env.OIDC_ISSUER || 'https://auth.gotravelnha.com/realms/gotravelnha').replace(/\/$/, '')
const adminBase = issuer.replace('/realms/', '/admin/realms/')
const clientId = process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'iam-admin'
const clientSecret = process.env.KEYCLOAK_ADMIN_CLIENT_SECRET
const loginClientId = process.env.OIDC_CLIENT_ID || 'gotravelnha-web'

if (!clientSecret) {
  console.error('Set KEYCLOAK_ADMIN_CLIENT_SECRET (the iam-admin client secret).')
  process.exit(1)
}

const prisma = new PrismaClient()

let token = ''
let tokenExpires = 0
async function adminToken() {
  if (token && tokenExpires > Date.now() + 30_000) return token
  const res = await fetch(`${issuer}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret! })
  })
  if (!res.ok) throw new Error(`token: ${res.status} ${await res.text()}`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  token = json.access_token
  tokenExpires = Date.now() + json.expires_in * 1000
  return token
}

async function kc(path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${adminBase}${path}`, {
    method: init.method || 'GET',
    headers: { authorization: `Bearer ${await adminToken()}`, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body)
  })
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${path}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

const findByEmail = async (email: string) =>
  ((await kc(`/users?email=${encodeURIComponent(email)}&exact=true`)) as { id: string }[])[0] || null

async function main() {
  const groups = (await kc('/groups?search=gotravelnha-admins&exact=true')) as { id: string; name: string }[]
  const adminGroup = groups.find((g) => g.name === 'gotravelnha-admins')
  if (!adminGroup) throw new Error('Keycloak group gotravelnha-admins not found')

  const users = await prisma.user.findMany({
    where: { keycloakId: null, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true, role: true, password: true, provider: true },
    orderBy: { createdAt: 'asc' }
  })
  console.log(`${users.length} active users without keycloakId. ${apply ? 'APPLYING' : 'Dry run (pass --apply to change anything)'}${sendEmails ? ', sending emails' : ''}.\n`)

  const totals = { linked: 0, created: 0, admins: 0, emailed: 0, failed: 0 }
  for (const user of users) {
    const email = user.email.trim().toLowerCase()
    try {
      let kcUser = await findByEmail(email)
      const action = kcUser ? 'link' : 'create'
      console.log(`${action.padEnd(6)} ${email}${user.role === 'ADMIN' ? ' (admin)' : ''}`)
      if (!apply) continue

      if (!kcUser) {
        await kc('/users', {
          method: 'POST',
          body: { username: email, email, emailVerified: true, enabled: true, firstName: user.firstName || undefined, lastName: user.lastName || undefined }
        })
        kcUser = await findByEmail(email)
        if (!kcUser) throw new Error('created user not found')
        totals.created++
      } else {
        totals.linked++
      }

      await prisma.user.update({ where: { id: user.id }, data: { keycloakId: kcUser.id } })

      if (user.role === 'ADMIN') {
        await kc(`/users/${kcUser.id}/groups/${adminGroup.id}`, { method: 'PUT' })
        totals.admins++
      }

      // Only accounts that had a local password; a Keycloak user that already existed keeps its own
      if (sendEmails && action === 'create' && user.password) {
        await kc(`/users/${kcUser.id}/execute-actions-email?client_id=${loginClientId}&lifespan=${60 * 60 * 24 * 7}`, {
          method: 'PUT',
          body: ['UPDATE_PASSWORD']
        })
        totals.emailed++
      }
    } catch (error) {
      totals.failed++
      console.error(`  failed ${email}:`, error instanceof Error ? error.message : error)
    }
  }

  console.log('\nDone.', totals)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
