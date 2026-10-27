import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { hotelDeals } from './handlers/hotel-deals'
import { importHotelDeals } from './handlers/import-hotel-deals'
import { importPromoCodes } from './handlers/import-promo-codes'
import { promoCodes } from './handlers/promo-codes'
import { widgets } from './handlers/widgets'

/** klook use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class KlookService {
  hotelDeals(event: HttpEvent) {
    return hotelDeals(event)
  }

  importHotelDeals(event: HttpEvent) {
    return importHotelDeals(event)
  }

  importPromoCodes(event: HttpEvent) {
    return importPromoCodes(event)
  }

  promoCodes(event: HttpEvent) {
    return promoCodes(event)
  }

  widgets(event: HttpEvent) {
    return widgets(event)
  }
}
