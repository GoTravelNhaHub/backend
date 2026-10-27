import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { ShareService } from './share.service'

@ApiTags("share")
@Controller()
export class ShareController {
  constructor(private readonly service: ShareService) {}

  @Get("api/share/trips/:shareId")
  @ApiOperation({ summary: "Public, read-only view of a shared trip. Only what the plan needs: no owner, no budget," })
  @ApiParam({ name: "shareId" })
  tripsShareIdGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsShareIdGet(toEvent(req, res)))
  }
}
