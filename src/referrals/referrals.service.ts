import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { create } from './handlers/create'
import { myCode } from './handlers/my-code'
import { stats } from './handlers/stats'
import { trackClick } from './handlers/track-click'

/** referrals use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class ReferralsService {
  create(event: HttpEvent) {
    return create(event)
  }

  myCode(event: HttpEvent) {
    return myCode(event)
  }

  stats(event: HttpEvent) {
    return stats(event)
  }

  trackClick(event: HttpEvent) {
    return trackClick(event)
  }
}
