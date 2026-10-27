import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { exchange } from './handlers/exchange'

/** exchange use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class ExchangeService {
  exchange(event: HttpEvent) {
    return exchange(event)
  }
}
