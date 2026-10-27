import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { destinationsGet } from './handlers/destinations.get'
import { slugGet } from './handlers/slug.get'

/** destinations use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class DestinationsService {
  destinationsGet(event: HttpEvent) {
    return destinationsGet(event)
  }

  slugGet(event: HttpEvent) {
    return slugGet(event)
  }
}
