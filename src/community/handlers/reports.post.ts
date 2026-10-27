import { type HttpEvent, createError, readBody, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { ReportInputSchema, reportContent } from '../services/moderation'

// Report a trip, comment or profile to the moderators
export async function reportsPost(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-report', 10, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const parsed = ReportInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Choose a reason.' })
  await reportContent(user.id, parsed.data)
  return { success: true }
}

// Request body schema, used by the controller's Swagger docs
export { ReportInputSchema as reportsPostBodySchema }
