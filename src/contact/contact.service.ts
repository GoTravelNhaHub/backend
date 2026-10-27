import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { contact } from './handlers/contact'

/** contact use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class ContactService {
  contact(event: HttpEvent) {
    return contact(event)
  }
}
