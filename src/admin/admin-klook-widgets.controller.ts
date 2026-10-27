import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: klook-widgets")
@Controller()
export class AdminKlookWidgetsController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/klook-widgets")
  @ApiOperation({ summary: "GET /api/admin/klook-widgets (GET)" })
  @ApiQuery({ name: "activeOnly", required: false })
  @AdminOnly()
  klookWidgetsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookWidgets(toEvent(req, res)))
  }

  @Post("api/admin/klook-widgets")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/admin/klook-widgets (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"adId": {}, "category": {}, "description": {}, "displayOrder": {}, "icon": {}, "isActive": {}, "name": {}, "widgetType": {}}} })
  @AdminOnly()
  klookWidgetsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookWidgets(toEvent(req, res)))
  }

  @Put("api/admin/klook-widgets/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT/DELETE /api/admin/klook-widgets/[id] (PUT)" })
  @ApiParam({ name: "id" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"adId": {}, "category": {}, "description": {}, "displayOrder": {}, "icon": {}, "isActive": {}, "name": {}, "widgetType": {}}} })
  @AdminOnly()
  klookWidgetsIdPut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookWidgetsId(toEvent(req, res)))
  }

  @Delete("api/admin/klook-widgets/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT/DELETE /api/admin/klook-widgets/[id] (DELETE)" })
  @ApiParam({ name: "id" })
  @AdminOnly()
  klookWidgetsIdDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.klookWidgetsId(toEvent(req, res)))
  }
}
