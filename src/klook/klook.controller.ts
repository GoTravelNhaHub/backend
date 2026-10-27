import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { KlookService } from './klook.service'

@ApiTags("klook")
@Controller()
export class KlookController {
  constructor(private readonly service: KlookService) {}

  @Get("api/klook/hotel-deals")
  @ApiOperation({ summary: "Fetch all active hotel deals (GET)" })
  @ApiQuery({ name: "platform", required: false })
  hotelDealsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.hotelDeals(toEvent(req, res)))
  }

  @Post("api/klook/hotel-deals")
  @HttpCode(200)
  @ApiOperation({ summary: "Fetch all active hotel deals (POST)" })
  hotelDealsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.hotelDeals(toEvent(req, res)))
  }

  @Get("api/klook/import-hotel-deals")
  @ApiOperation({ summary: "Parse CSV (GET)" })
  @AdminOnly()
  importHotelDealsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.importHotelDeals(toEvent(req, res)))
  }

  @Post("api/klook/import-hotel-deals")
  @HttpCode(200)
  @ApiOperation({ summary: "Parse CSV (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"csvData": {}}} })
  @AdminOnly()
  importHotelDealsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.importHotelDeals(toEvent(req, res)))
  }

  @Get("api/klook/import-promo-codes")
  @ApiOperation({ summary: "Handle format: 2025-10-01 00:00:00 (GET)" })
  @AdminOnly()
  importPromoCodesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.importPromoCodes(toEvent(req, res)))
  }

  @Post("api/klook/import-promo-codes")
  @HttpCode(200)
  @ApiOperation({ summary: "Handle format: 2025-10-01 00:00:00 (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"csvData": {}}} })
  @AdminOnly()
  importPromoCodesPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.importPromoCodes(toEvent(req, res)))
  }

  @Get("api/klook/promo-codes")
  @ApiOperation({ summary: "Fetch all active promo codes (GET)" })
  @ApiQuery({ name: "platform", required: false })
  promoCodesGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.promoCodes(toEvent(req, res)))
  }

  @Post("api/klook/promo-codes")
  @HttpCode(200)
  @ApiOperation({ summary: "Fetch all active promo codes (POST)" })
  promoCodesPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.promoCodes(toEvent(req, res)))
  }

  @Get("api/klook/widgets")
  @ApiOperation({ summary: "GET /api/klook/widgets (GET)" })
  @ApiQuery({ name: "widgetType", required: false })
  widgetsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.widgets(toEvent(req, res)))
  }

  @Post("api/klook/widgets")
  @HttpCode(200)
  @ApiOperation({ summary: "GET /api/klook/widgets (POST)" })
  widgetsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.widgets(toEvent(req, res)))
  }
}
