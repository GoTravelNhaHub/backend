import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { travellersGet } from './handlers/travellers.get'
import { travellersPost } from './handlers/travellers.post'
import { idDelete } from './handlers/id.delete'
import { idPut } from './handlers/id.put'

/** travellers use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class TravellersService {
  travellersGet(event: HttpEvent) {
    return travellersGet(event)
  }

  travellersPost(event: HttpEvent) {
    return travellersPost(event)
  }

  idDelete(event: HttpEvent) {
    return idDelete(event)
  }

  idPut(event: HttpEvent) {
    return idPut(event)
  }
}
