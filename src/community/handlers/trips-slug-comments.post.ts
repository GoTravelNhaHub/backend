import { type HttpEvent, createError, getRouterParam, readBody, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { CommentInputSchema, addComment } from '../services/comments'

// Post a comment (needs a traveler profile). Limited per IP here and per user in the service.
export async function tripsSlugCommentsPost(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-comment', 10, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })
  const parsed = CommentInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Write a comment first.' })
  return { success: true, data: await addComment(user.id, slug, parsed.data) }
}

// Request body schema, used by the controller's Swagger docs
export { CommentInputSchema as tripsSlugCommentsPostBodySchema }
