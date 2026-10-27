import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: klook")
@Controller()
export class AdminKlookController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/klook")
  @ApiOperation({ summary: "Status filter (isActive for now, can be extended to isPublished later)" })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "sort", required: false })
  @ApiQuery({ name: "status", required: false })
  @AdminOnly()
  klookGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookGet(toEvent(req, res)))
  }

  @Post("api/admin/klook")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/admin/klook" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"checkoutNotes": {"type": "string"}, "id": {"type": "string"}, "isActive": {"type": "boolean"}, "isPublished": {"type": "boolean"}, "isSelfBookable": {"type": "boolean"}, "notes": {"type": "string"}, "publicPrice": {"type": "number"}, "publishedAt": {}, "stripePriceId": {"type": "string"}}} })
  @AdminOnly()
  klookPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookPost(toEvent(req, res)))
  }
}
