import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: affiliate")
@Controller()
export class AdminAffiliateController {
  constructor(private readonly service: AdminService) {}

  @Post("api/admin/affiliate/conversions/import")
  @HttpCode(200)
  @ApiOperation({ summary: "Imports a partner commission report (admin-gated by server/middleware/auth-guard.ts)." })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"csv": {"type": "string"}}} })
  @AdminOnly()
  affiliateConversionsImportPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.affiliateConversionsImportPost(toEvent(req, res)))
  }

  @Get("api/admin/affiliate/slots")
  @ApiOperation({ summary: "GET /api/admin/affiliate/slots" })
  @AdminOnly()
  affiliateSlotsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.affiliateSlotsGet(toEvent(req, res)))
  }

  @Post("api/admin/affiliate/slots")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/admin/affiliate/slots" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"baseUrl": {"type": "string"}, "category": {"type": "string"}, "description": {"type": "string"}, "destination": {"type": "string"}, "id": {"type": "string"}, "isActive": {"type": "boolean"}, "priority": {"type": "number"}, "provider": {"type": "string", "enum": ["trip", "klook"]}, "title": {"type": "string"}}} })
  @AdminOnly()
  affiliateSlotsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.affiliateSlotsPost(toEvent(req, res)))
  }
}
