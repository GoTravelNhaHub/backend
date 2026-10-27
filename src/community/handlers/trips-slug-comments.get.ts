import { type HttpEvent, createError, getQuery, getRouterParam, setHeader } from '../../common/http'
import { getSessionUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { listComments } from '../services/comments'

// Comments on a public or unlisted trip, newest first. Marks the viewer's own comments, so never cached.
export async function tripsSlugCommentsGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-comments-read', 120, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const slug = getRouterParam(event, 'slug') || ''
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) throw createError({ statusCode: 404, message: 'This trip was not found.' })
  const viewer = await getSessionUser(event.req).catch(() => null)
  const cursor = getQuery(event).cursor
  return { success: true, ...(await listComments(slug, viewer?.id ?? null, typeof cursor === 'string' ? cursor : undefined)) }
}
