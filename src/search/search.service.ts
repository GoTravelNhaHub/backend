import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { globalPost } from './handlers/global.post'

/** search use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class SearchService {
  globalPost(event: HttpEvent) {
    return globalPost(event)
  }
}
