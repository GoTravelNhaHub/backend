import { type HttpEvent, createError, readBody } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { ProfileInputSchema, saveOwnProfile } from '../services/profile'

export async function profilePut(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-profile', 20, 60 * 60 * 1000)
  const user = await requireUser(event.req)
  const parsed = ProfileInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 400, message: 'Check your handle and display name.' })
  }
  return { success: true, data: await saveOwnProfile(user.id, parsed.data) }
}

// Request body schema, used by the controller's Swagger docs
export { ProfileInputSchema as profilePutBodySchema }
