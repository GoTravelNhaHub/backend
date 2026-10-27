import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { ExchangeService } from './exchange.service'

@ApiTags("exchange")
@Controller()
export class ExchangeController {
  constructor(private readonly service: ExchangeService) {}

  @Get("api/exchange")
  @ApiOperation({ summary: "GET /api/exchange (GET)" })
  exchangeGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.exchange(toEvent(req, res)))
  }

  @Post("api/exchange")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/exchange (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"amount": {}, "converted": {}, "direction": {}, "email": {}, "name": {}}} })
  exchangePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.exchange(toEvent(req, res)))
  }
}
