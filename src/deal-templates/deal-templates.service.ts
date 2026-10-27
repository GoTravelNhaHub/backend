import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { dealTemplatesGet } from './handlers/deal-templates.get'
import { slugGet } from './handlers/slug.get'

/** deal-templates use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class DealTemplatesService {
  dealTemplatesGet(event: HttpEvent) {
    return dealTemplatesGet(event)
  }

  slugGet(event: HttpEvent) {
    return slugGet(event)
  }
}
