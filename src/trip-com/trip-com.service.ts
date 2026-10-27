import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { hotels } from './handlers/hotels'

/** trip.com use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class TripComService {
  hotels(event: HttpEvent) {
    return hotels(event)
  }
}
