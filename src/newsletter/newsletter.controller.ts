import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { NewsletterService } from './newsletter.service'

@ApiTags("newsletter")
@Controller()
export class NewsletterController {
  constructor(private readonly service: NewsletterService) {}

  @Get("api/newsletter/subscribe")
  @ApiOperation({ summary: "POST /api/newsletter/subscribe (GET)" })
  subscribeGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.subscribe(toEvent(req, res)))
  }

  @Post("api/newsletter/subscribe")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/newsletter/subscribe (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"email": {"type": "string"}, "name": {"type": "string"}, "source": {"type": "string"}}} })
  subscribePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.subscribe(toEvent(req, res)))
  }

  @Post("api/newsletter/unsubscribe")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/newsletter/unsubscribe" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"email": {"type": "string"}, "token": {}}} })
  unsubscribePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.unsubscribePost(toEvent(req, res)))
  }
}
