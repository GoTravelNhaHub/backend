import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { AffiliateService } from './affiliate.service'

@ApiTags("affiliate")
@Controller()
export class AffiliateController {
  constructor(private readonly service: AffiliateService) {}

  @Post("api/affiliate/click")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/affiliate/click" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"baseUrl": {"type": "string"}, "entityId": {"type": "string"}, "metadata": {"type": "object"}, "offerId": {"type": "string"}, "pagePath": {"type": "string"}, "placementKey": {"type": "string"}, "provider": {"type": "string"}, "referrer": {"type": "string"}, "sessionId": {"type": "string"}}} })
  clickPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.clickPost(toEvent(req, res)))
  }

  @Get("api/affiliate/deals")
  @ApiOperation({ summary: "Only offers a partner currently sells" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "platform", required: false })
  @ApiQuery({ name: "sessionId", required: false })
  dealsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealsGet(toEvent(req, res)))
  }

  @Post("api/affiliate/events")
  @HttpCode(200)
  @ApiOperation({ summary: "Caller metadata is nested and size-capped so it can't overwrite these fields" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"entityId": {"type": "string"}, "eventName": {"type": "string", "enum": ["affiliate_offer_impression", "affiliate_offer_fallback_used", "affiliate_offer_unavailable"]}, "metadata": {"type": "object"}, "offerId": {"type": "string"}, "pagePath": {"type": "string"}, "placementKey": {"type": "string"}, "provider": {"type": "string"}, "sessionId": {"type": "string"}}} })
  eventsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.eventsPost(toEvent(req, res)))
  }

  @Get("api/affiliate/offers")
  @ApiOperation({ summary: "GET /api/affiliate/offers" })
  @ApiQuery({ name: "entityId", required: false })
  @ApiQuery({ name: "pagePath", required: false })
  @ApiQuery({ name: "placementKey", required: false })
  @ApiQuery({ name: "sessionId", required: false })
  @ApiQuery({ name: "slug", required: false })
  offersGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.offersGet(toEvent(req, res)))
  }

  @Get("api/affiliate/postback")
  @ApiOperation({ summary: "Partner conversion postback (GET or POST). Configure the partner to call: (GET)" })
  postbackGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.postback(toEvent(req, res)))
  }

  @Post("api/affiliate/postback")
  @HttpCode(200)
  @ApiOperation({ summary: "Partner conversion postback (GET or POST). Configure the partner to call: (POST)" })
  @ApiBody({ required: false, schema: { type: 'object' } })
  postbackPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.postback(toEvent(req, res)))
  }

  @Get("api/affiliate/shortcuts")
  @ApiOperation({ summary: "GET /api/affiliate/shortcuts" })
  shortcutsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.shortcutsGet(toEvent(req, res)))
  }
}
