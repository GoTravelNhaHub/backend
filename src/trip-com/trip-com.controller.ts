import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { TripComService } from './trip-com.service'

@ApiTags("trip.com")
@Controller()
export class TripComController {
  constructor(private readonly service: TripComService) {}

  @Get("api/trip/hotels")
  @ApiOperation({ summary: "server/api/trip/hotels.ts (GET)" })
  hotelsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.hotels(toEvent(req, res)))
  }

  @Post("api/trip/hotels")
  @HttpCode(200)
  @ApiOperation({ summary: "server/api/trip/hotels.ts (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"checkinDate": {}, "checkoutDate": {}, "cityId": {}, "pageIndex": {}, "pageSize": {}}} })
  hotelsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.hotels(toEvent(req, res)))
  }
}
