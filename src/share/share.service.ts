import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { tripsShareIdGet } from './handlers/trips-shareId.get'

/** share use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class ShareService {
  tripsShareIdGet(event: HttpEvent) {
    return tripsShareIdGet(event)
  }
}
