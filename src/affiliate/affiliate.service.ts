import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { clickPost } from './handlers/click.post'
import { dealsGet } from './handlers/deals.get'
import { eventsPost } from './handlers/events.post'
import { offersGet } from './handlers/offers.get'
import { postback } from './handlers/postback'
import { shortcutsGet } from './handlers/shortcuts.get'

/** affiliate use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class AffiliateService {
  clickPost(event: HttpEvent) {
    return clickPost(event)
  }

  dealsGet(event: HttpEvent) {
    return dealsGet(event)
  }

  eventsPost(event: HttpEvent) {
    return eventsPost(event)
  }

  offersGet(event: HttpEvent) {
    return offersGet(event)
  }

  postback(event: HttpEvent) {
    return postback(event)
  }

  shortcutsGet(event: HttpEvent) {
    return shortcutsGet(event)
  }
}
