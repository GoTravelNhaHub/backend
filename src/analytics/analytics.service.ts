import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { trip } from './handlers/trip'
import { trackActivity } from './handlers/track-activity'

/** analytics use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class AnalyticsService {
  trip(event: HttpEvent) {
    return trip(event)
  }

  trackActivity(event: HttpEvent) {
    return trackActivity(event)
  }
}
