import { type HttpEvent, getQuery, setHeader } from '../../common/http'
import { listReportQueue } from '../../community/services/moderation'

// Moderation queue. Admin only (server/middleware/auth-guard.ts guards /api/admin/**).
export async function communityReportsGet(event: HttpEvent) {
  setHeader(event, 'cache-control', 'private, no-store')
  const status = getQuery(event).status
  const value = status === 'ACTIONED' || status === 'DISMISSED' ? status : 'OPEN'
  return { success: true, data: await listReportQueue(value) }
}
