import { type HttpEvent, getQuery, setHeader } from '../../common/http'
import { getSessionUser } from '../../auth/session'
import { enforceRateLimit } from '../../common/utils/activity-limits'
import { followState } from '../services/social'

// Which of the given handles the visitor follows. Signed-out visitors get an empty list.
export async function followStateGet(event: HttpEvent) {
  enforceRateLimit(event.req, 'community-follow-state', 120, 60 * 1000)
  setHeader(event, 'cache-control', 'private, no-store')
  const user = await getSessionUser(event.req).catch(() => null)
  const raw = getQuery(event).handles
  const handles = (typeof raw === 'string' ? raw.split(',') : []).map((handle) => handle.toLowerCase()).filter((handle) => /^[a-z0-9_]{3,30}$/.test(handle))
  return { success: true, data: user ? await followState(user.id, handles) : [] }
}
