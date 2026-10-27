import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { users } from './handlers/users'
import { id } from './handlers/id'

/** users use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class UsersService {
  users(event: HttpEvent) {
    return users(event)
  }

  id(event: HttpEvent) {
    return id(event)
  }
}
