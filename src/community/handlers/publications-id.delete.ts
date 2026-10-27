import { type HttpEvent, getRouterParam } from '../../common/http'
import { requireUser } from '../../auth/session'
import { deletePublication } from '../services/trips'

// Take your trip off the community. Your private trip stays in My trips.
export async function publicationsIdDelete(event: HttpEvent) {
  const user = await requireUser(event.req)
  await deletePublication(user, getRouterParam(event, 'id') || '')
  return { success: true }
}
