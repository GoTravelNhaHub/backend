import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: blog")
@Controller()
export class AdminBlogController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/blog/posts")
  @ApiOperation({ summary: "GET /api/admin/blog/posts - List all posts (admin) (GET)" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  @AdminOnly()
  blogPostsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.blogPosts(toEvent(req, res)))
  }

  @Post("api/admin/blog/posts")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/admin/blog/posts - List all posts (admin) (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"authorId": {}, "category": {}, "content": {}, "excerpt": {}, "featuredImage": {}, "isPublished": {}, "seoMeta": {}, "slug": {}, "tags": {}, "title": {}}} })
  @AdminOnly()
  blogPostsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.blogPosts(toEvent(req, res)))
  }
}
