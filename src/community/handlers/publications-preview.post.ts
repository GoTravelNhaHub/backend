import { type HttpEvent, createError, readBody } from '../../common/http'
import * as z from 'zod/v4'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { previewPublication } from '../services/trips'

const PreviewSchema = z.object({
  tripId: z.string().uuid(),
  alsoReplace: z.array(z.string().trim().max(40)).max(10).default([])
})

// What publishing one of your trips would make public. Saves nothing.
export async function publicationsPreviewPost(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-preview', 60, 10 * 60 * 1000)
  const user = await requireUser(event.req)
  const parsed = PreviewSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Trip not found.' })
  return { success: true, ...(await previewPublication(user, parsed.data.tripId, parsed.data.alsoReplace)) }
}

// Request body schema, used by the controller's Swagger docs
export { PreviewSchema as publicationsPreviewPostBodySchema }
