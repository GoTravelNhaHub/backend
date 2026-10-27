import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { AnalyticsService } from './analytics.service'

@ApiTags("analytics")
@Controller()
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get("api/analytics/trip")
  @ApiOperation({ summary: "Trip.com Analytics API (GET)" })
  tripGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trip(toEvent(req, res)))
  }

  @Post("api/analytics/trip")
  @HttpCode(200)
  @ApiOperation({ summary: "Trip.com Analytics API (POST)" })
  tripPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trip(toEvent(req, res)))
  }

  @Get("api/track-activity")
  @ApiOperation({ summary: "Log activity (in production, you'd save to database) (GET)" })
  trackActivityGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trackActivity(toEvent(req, res)))
  }

  @Post("api/track-activity")
  @HttpCode(200)
  @ApiOperation({ summary: "Log activity (in production, you'd save to database) (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"action": {"type": "string"}, "data": {"type": "object"}, "height": {"type": "number"}, "page": {"type": "string"}, "sessionId": {"type": "string"}, "timestamp": {"type": "string"}, "userAgent": {"type": "string"}, "viewport": {"type": "object"}, "width": {"type": "number"}}} })
  trackActivityPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trackActivity(toEvent(req, res)))
  }
}
