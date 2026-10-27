import { Controller, Get, Req, Res } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: dashboard")
@Controller()
export class AdminDashboardController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/dashboard/stats")
  @ApiOperation({ summary: "Admin dashboard (admin-gated by server/middleware/auth-guard.ts). Everything here is" })
  @AdminOnly()
  dashboardStatsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dashboardStatsGet(toEvent(req, res)))
  }
}
