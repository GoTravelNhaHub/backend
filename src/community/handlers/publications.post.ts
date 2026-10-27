import { type HttpEvent, createError, readBody } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { PublishInputSchema, publishTrip } from '../services/trips'

// Publish one of your trips, or republish it after editing the private trip
export async function publicationsPost(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-publish', 20, 60 * 60 * 1000)
  const user = await requireUser(event.req)
  const parsed = PublishInputSchema.safeParse(await readBody(event))
  if (!parsed.success) {
    const publicNotConfirmed = parsed.error.issues.some((issue) => issue.path[0] === 'confirmPublic')
    throw createError({
      statusCode: 400,
      message: publicNotConfirmed ? 'Confirm that the trip can be public.' : 'Check the title, description and tips.'
    })
  }
  return { success: true, data: await publishTrip(user, parsed.data) }
}

// Request body schema, used by the controller's Swagger docs
export { PublishInputSchema as publicationsPostBodySchema }
