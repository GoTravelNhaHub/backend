import { type HttpEvent, createError, getRouterParam, readBody, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { editComment } from '../services/comments'

// Edit your own comment
export async function commentsIdPatch(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-comment', 10, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const id = getRouterParam(event, 'id') || ''
  const body = (await readBody(event))?.body
  if (!/^[0-9a-f-]{36}$/i.test(id) || typeof body !== 'string') throw createError({ statusCode: 400, message: 'Write a comment first.' })
  await editComment(user.id, id, body)
  return { success: true }
}
