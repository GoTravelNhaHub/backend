import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { communityModeratePostBodySchema } from './handlers/community-moderate.post'
import { AdminService } from './admin.service'

@ApiTags("admin: community")
@Controller()
export class AdminCommunityController {
  constructor(private readonly service: AdminService) {}

  @Post("api/admin/community/moderate")
  @HttpCode(200)
  @ApiOperation({ summary: "Hide, restore or dismiss reports on a trip, comment or profile. Admin only." })
  @ApiBody({ schema: zodBodySchema(communityModeratePostBodySchema) })
  @AdminOnly()
  communityModeratePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.communityModeratePost(toEvent(req, res)))
  }

  @Get("api/admin/community/reports")
  @ApiOperation({ summary: "Moderation queue. Admin only (server/middleware/auth-guard.ts guards /api/admin/**)." })
  @AdminOnly()
  communityReportsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.communityReportsGet(toEvent(req, res)))
  }
}
