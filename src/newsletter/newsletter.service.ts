import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { subscribe } from './handlers/subscribe'
import { unsubscribePost } from './handlers/unsubscribe.post'

/** newsletter use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class NewsletterService {
  subscribe(event: HttpEvent) {
    return subscribe(event)
  }

  unsubscribePost(event: HttpEvent) {
    return unsubscribePost(event)
  }
}
