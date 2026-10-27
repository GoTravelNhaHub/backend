import { type HttpEvent } from '../../common/http'
import { requireUser } from '../../auth/session'
import { getOwnProfile, suggestFreeHandle } from '../services/profile'

// The signed-in user's public profile, or a suggested handle and name to start one
export async function profileGet(event: HttpEvent) {
  const user = await requireUser(event.req)
  const profile = await getOwnProfile(user.id)
  return {
    success: true,
    data: profile,
    suggestion: profile ? null : { handle: await suggestFreeHandle(user.firstName), displayName: user.firstName?.trim() || '' }
  }
}
