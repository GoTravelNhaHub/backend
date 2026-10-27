import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { DestinationsService } from './destinations.service'

@ApiTags("destinations")
@Controller()
export class DestinationsController {
  constructor(private readonly service: DestinationsService) {}

  @Get("api/destinations")
  @ApiOperation({ summary: "Destinations that have at least one bookable activity, with a count per city" })
  destinationsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.destinationsGet(toEvent(req, res)))
  }

  @Get("api/destinations/:slug")
  @ApiOperation({ summary: "Bookable activities for a destination, ranked for the family when ages or" })
  @ApiParam({ name: "slug" })
  @ApiQuery({ name: "ages", required: false })
  @ApiQuery({ name: "family", required: false })
  @ApiQuery({ name: "interests", required: false })
  slugGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.slugGet(toEvent(req, res)))
  }
}
