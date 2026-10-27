import { Injectable } from '@nestjs/common'
import type { HttpEvent } from '../common/http'
import { posts } from './handlers/posts'
import { postsSlug } from './handlers/posts-slug'

/** blog use cases. Each method runs one route handler from ./handlers. */
@Injectable()
export class BlogService {
  posts(event: HttpEvent) {
    return posts(event)
  }

  postsSlug(event: HttpEvent) {
    return postsSlug(event)
  }
}
