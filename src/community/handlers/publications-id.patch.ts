import { type HttpEvent, createError, getRouterParam, readBody } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { VisibilityInputSchema, setVisibility } from '../services/trips'

// Change who can see your published trip
export async function publicationsIdPatch(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-publish', 20, 60 * 60 * 1000)
  const user = await requireUser(event.req)
  const parsed = VisibilityInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Confirm that the trip can be public.' })
  return { success: true, data: await setVisibility(user, getRouterParam(event, 'id') || '', parsed.data) }
}

// Request body schema, used by the controller's Swagger docs
export { VisibilityInputSchema as publicationsIdPatchBodySchema }
