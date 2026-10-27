import { type HttpEvent, createError, readBody, setHeader } from '../../common/http'
import { requireAdmin } from '../../auth/session'
import { ModerationActionSchema, moderate } from '../../community/services/moderation'

// Hide, restore or dismiss reports on a trip, comment or profile. Admin only.
export async function communityModeratePost(event: HttpEvent) {
  setHeader(event, 'cache-control', 'private, no-store')
  // Also guarded by server/middleware/auth-guard.ts; the id is needed for the audit fields
  const admin = await requireAdmin(event.req)
  const parsed = ModerationActionSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Unknown moderation action.' })
  return { success: true, data: await moderate(admin.id, parsed.data) }
}

// Request body schema, used by the controller's Swagger docs
export { ModerationActionSchema as communityModeratePostBodySchema }
