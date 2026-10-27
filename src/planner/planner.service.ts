import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { chatPost } from './handlers/chat.post'
import { itineraryPost } from './handlers/itinerary.post'
import { generationsIdGet } from './handlers/generations-id.get'

/** planner use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class PlannerService {
  chatPost(event: HttpEvent) {
    return chatPost(event)
  }

  itineraryPost(event: HttpEvent) {
    return itineraryPost(event)
  }

  generationsIdGet(event: HttpEvent) {
    return generationsIdGet(event)
  }
}
