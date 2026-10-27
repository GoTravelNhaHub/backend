import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { chatPostBodySchema } from './handlers/chat.post'
import { PlannerService } from './planner.service'

@ApiTags("planner")
@Controller()
export class PlannerController {
  constructor(private readonly service: PlannerService) {}

  @Post("api/planner/chat")
  @HttpCode(200)
  @ApiOperation({ summary: "A chat turn is a short model call. The itinerary itself is still built and" })
  @ApiBody({ schema: zodBodySchema(chatPostBodySchema) })
  chatPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.chatPost(toEvent(req, res)))
  }

  @Post("api/planner/itinerary")
  @HttpCode(200)
  @ApiOperation({ summary: "Community trip this plan is based on: set by Customize with AI, and kept through revisions" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"adaptFrom": {}, "revise": {}}} })
  itineraryPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.itineraryPost(toEvent(req, res)))
  }

  @Get("api/planner/generations/:id")
  @ApiOperation({ summary: "Reloads a generated itinerary (e.g. after a guest signs in) with live prices" })
  @ApiParam({ name: "id" })
  generationsIdGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.generationsIdGet(toEvent(req, res)))
  }
}
