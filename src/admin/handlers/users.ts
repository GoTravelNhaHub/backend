import { type HttpEvent, createError, readBody } from '../../common/http'
import * as z from 'zod/v4'
import prisma from '../../prisma/prisma.client'
import { ensureKeycloakUser, setKeycloakAdmin, setKeycloakPassword } from '../../auth/keycloak-admin'

// Admin creates an account with any role (admin-gated by server/middleware/auth-guard.ts).
// The login lives in Keycloak: the password is set there as temporary, so the user picks a new one at first sign-in.
const CreateSchema = z.object({
  username: z.string().trim().min(3).max(40),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
  isActive: z.boolean().default(true)
})

export async function users(event: HttpEvent) {
  const parsed = CreateSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      message: 'Check the details: username 3–40 characters, a valid email, and a password of at least 8 characters.'
    })
  }
  const body = parsed.data

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: body.username }, { email: body.email }] },
    select: { username: true }
  })
  if (existing) {
    throw createError({
      statusCode: 400,
      message: existing.username === body.username ? 'Username already exists' : 'Email already exists'
    })
  }

  const keycloakId = await ensureKeycloakUser(body)
  await setKeycloakPassword(keycloakId, body.password, true)
  if (body.role === 'ADMIN') await setKeycloakAdmin(keycloakId, true)

  const user = await prisma.user.create({
    data: {
      keycloakId,
      username: body.username,
      email: body.email.toLowerCase(),
      firstName: body.firstName || null,
      lastName: body.lastName || null,
      role: body.role,
      isActive: body.isActive
    }
  })

  const { password, resetToken, resetTokenExpires, ...safeUser } = user
  return { success: true, user: safeUser, message: 'User created successfully' }
}

// Request body schema, used by the controller's Swagger docs
export { CreateSchema as usersBodySchema }
