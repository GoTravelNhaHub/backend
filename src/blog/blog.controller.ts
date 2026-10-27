import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { BlogService } from './blog.service'

@ApiTags("blog")
@Controller()
export class BlogController {
  constructor(private readonly service: BlogService) {}

  @Get("api/blog/posts")
  @ApiOperation({ summary: "GET /api/blog/posts (GET)" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "offset", required: false })
  postsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.posts(toEvent(req, res)))
  }

  @Post("api/blog/posts")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/blog/posts (POST)" })
  postsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.posts(toEvent(req, res)))
  }

  @Get("api/blog/posts/:slug")
  @ApiOperation({ summary: "GET /api/blog/posts/:slug (GET)" })
  @ApiParam({ name: "slug" })
  postsSlugGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.postsSlug(toEvent(req, res)))
  }

  @Post("api/blog/posts/:slug")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/blog/posts/:slug (POST)" })
  @ApiParam({ name: "slug" })
  postsSlugPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.postsSlug(toEvent(req, res)))
  }
}
