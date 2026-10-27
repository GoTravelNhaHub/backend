import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: support")
@Controller()
export class AdminSupportController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/support/messages")
  @ApiOperation({ summary: "Contact form inbox (admin-gated by server/middleware/auth-guard.ts). view=open (default) or all." })
  @ApiQuery({ name: "view", required: false })
  @AdminOnly()
  supportMessagesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.supportMessagesGet(toEvent(req, res)))
  }

  @Post("api/admin/support/messages/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "Mark a contact message handled, or reopen it" })
  @ApiParam({ name: "id" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"action": {}}} })
  @AdminOnly()
  supportMessagesIdPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.supportMessagesIdPost(toEvent(req, res)))
  }
}
