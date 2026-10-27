import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: analytics")
@Controller()
export class AdminAnalyticsController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/analytics/activities")
  @ApiOperation({ summary: "GET /api/admin/analytics/activities" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "window", required: false })
  @AdminOnly()
  analyticsActivitiesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.analyticsActivitiesGet(toEvent(req, res)))
  }

  @Get("api/admin/analytics/affiliate")
  @ApiOperation({ summary: "GET /api/admin/analytics/affiliate" })
  @ApiQuery({ name: "window", required: false })
  @AdminOnly()
  analyticsAffiliateGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.analyticsAffiliateGet(toEvent(req, res)))
  }

  @Get("api/admin/analytics/affiliate-performance")
  @ApiOperation({ summary: "GET /api/admin/analytics/affiliate-performance" })
  @ApiQuery({ name: "window", required: false })
  @AdminOnly()
  analyticsAffiliatePerformanceGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.analyticsAffiliatePerformanceGet(toEvent(req, res)))
  }

  @Get("api/admin/analytics/unit-economics")
  @ApiOperation({ summary: "Per-order economics for self-checkout bookings plus affiliate clicks and commissions." })
  @ApiQuery({ name: "days", required: false })
  @AdminOnly()
  analyticsUnitEconomicsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.analyticsUnitEconomicsGet(toEvent(req, res)))
  }
}
