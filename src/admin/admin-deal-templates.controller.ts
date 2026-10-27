import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { AdminService } from './admin.service'

@ApiTags("admin: deal-templates")
@Controller()
export class AdminDealTemplatesController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/deal-templates")
  @ApiOperation({ summary: "GET /api/admin/deal-templates (GET)" })
  @ApiQuery({ name: "activeOnly", required: false })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "page", required: false })
  @ApiQuery({ name: "search", required: false })
  @AdminOnly()
  dealTemplatesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplates(toEvent(req, res)))
  }

  @Post("api/admin/deal-templates")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/admin/deal-templates (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"badge": {}, "category": {}, "comparison": {}, "description": {}, "destination": {}, "heroImage": {}, "heroImageFetchedAt": {}, "heroImageSource": {}, "isActive": {}, "lastUpdatedLabel": {}, "placementKey": {}, "primaryBaseUrl": {}, "primaryCtaLabel": {}, "primaryProvider": {}, "slug": {}, "summaryBullets": {}, "tips": {}, "title": {}}} })
  @AdminOnly()
  dealTemplatesPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplates(toEvent(req, res)))
  }

  @Post("api/admin/deal-templates/fetch-image")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/admin/deal-templates/fetch-image" })
  @AdminOnly()
  dealTemplatesFetchImagePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplatesFetchImagePost(toEvent(req, res)))
  }

  @Put("api/admin/deal-templates/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT /api/admin/deal-templates/:id (PUT)" })
  @ApiParam({ name: "id" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"badge": {}, "category": {}, "comparison": {}, "description": {}, "destination": {}, "heroImage": {}, "heroImageFetchedAt": {}, "heroImageSource": {}, "isActive": {}, "lastUpdatedLabel": {}, "placementKey": {}, "primaryBaseUrl": {}, "primaryCtaLabel": {}, "primaryProvider": {}, "slug": {}, "summaryBullets": {}, "tips": {}, "title": {}}} })
  @AdminOnly()
  dealTemplatesIdPut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplatesId(toEvent(req, res)))
  }

  @Delete("api/admin/deal-templates/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT /api/admin/deal-templates/:id (DELETE)" })
  @ApiParam({ name: "id" })
  @AdminOnly()
  dealTemplatesIdDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.dealTemplatesId(toEvent(req, res)))
  }
}
