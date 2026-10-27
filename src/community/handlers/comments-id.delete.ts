import { type HttpEvent, createError, getRouterParam, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { deleteComment } from '../services/comments'

// Delete your own comment (admins can delete any)
export async function commentsIdDelete(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-comment', 20, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id') || ''
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw createError({ statusCode: 404, message: 'This comment was not found.' })
  await deleteComment(user, id)
  return { success: true }
}
