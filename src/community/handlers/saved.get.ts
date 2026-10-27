import { type HttpEvent, getQuery, setHeader } from '../../common/http'
import { requireUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { listSaved } from '../services/social'

// The signed-in user's saved trips, newest first. Cursor: the last save's timestamp.
export async function savedGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-saved', 60, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await requireUser(event.req)
  const cursor = getQuery(event).cursor
  return { success: true, ...(await listSaved(user.id, typeof cursor === 'string' ? cursor : undefined)) }
}
