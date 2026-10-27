import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { DealTemplatesService } from './deal-templates.service'

@ApiTags("deal-templates")
@Controller()
export class DealTemplatesController {
  constructor(private readonly service: DealTemplatesService) {}

  @Get("api/deal-templates")
  @ApiOperation({ summary: "GET /api/deal-templates" })
  dealTemplatesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplatesGet(toEvent(req, res)))
  }

  @Get("api/deal-templates/:slug")
  @ApiOperation({ summary: "GET /api/deal-templates/:slug" })
  @ApiParam({ name: "slug" })
  slugGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.slugGet(toEvent(req, res)))
  }
}
