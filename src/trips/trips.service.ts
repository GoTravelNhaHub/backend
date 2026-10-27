import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { tripsGet } from './handlers/trips.get'
import { tripsPost } from './handlers/trips.post'
import { idDelete } from './handlers/id.delete'
import { idGet } from './handlers/id.get'
import { idRecommendationsGet } from './handlers/id-recommendations.get'
import { idSharePost } from './handlers/id-share.post'

/** trips use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class TripsService {
  tripsGet(event: HttpEvent) {
    return tripsGet(event)
  }

  tripsPost(event: HttpEvent) {
    return tripsPost(event)
  }

  idDelete(event: HttpEvent) {
    return idDelete(event)
  }

  idGet(event: HttpEvent) {
    return idGet(event)
  }

  idRecommendationsGet(event: HttpEvent) {
    return idRecommendationsGet(event)
  }

  idSharePost(event: HttpEvent) {
    return idSharePost(event)
  }
}
