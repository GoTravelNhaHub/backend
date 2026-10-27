import { Controller, Delete, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { TripsService } from './trips.service'

@ApiTags("trips")
@Controller()
export class TripsController {
  constructor(private readonly service: TripsService) {}

  @Get("api/trips")
  @ApiOperation({ summary: "GET /api/trips" })
  @Auth()
  tripsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsGet(toEvent(req, res)))
  }

  @Post("api/trips")
  @HttpCode(200)
  @ApiOperation({ summary: "Saves a generated itinerary to the signed-in user's trips. Takes the generation id," })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"generationId": {"type": "string"}, "title": {"type": "string"}}} })
  @Auth()
  tripsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.tripsPost(toEvent(req, res)))
  }

  @Delete("api/trips/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "DELETE /api/trips/:id" })
  @ApiParam({ name: "id" })
  @Auth()
  idDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idDelete(toEvent(req, res)))
  }

  @Get("api/trips/:id")
  @ApiOperation({ summary: "Community version of this trip, if the owner published it" })
  @ApiParam({ name: "id" })
  @Auth()
  idGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idGet(toEvent(req, res)))
  }

  @Get("api/trips/:id/recommendations")
  @ApiOperation({ summary: "Activities that fit a saved trip's family and are not already in the itinerary" })
  @ApiParam({ name: "id" })
  @Auth()
  idRecommendationsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idRecommendationsGet(toEvent(req, res)))
  }

  @Post("api/trips/:id/share")
  @HttpCode(200)
  @ApiOperation({ summary: "Turn a trip's public link on or off. Turning it off clears the code, so old links stop working." })
  @ApiParam({ name: "id" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"enabled": {"type": "boolean"}}} })
  @Auth()
  idSharePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idSharePost(toEvent(req, res)))
  }
}
