import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { contactBodySchema } from './handlers/contact'
import { ContactService } from './contact.service'

@ApiTags("contact")
@Controller()
export class ContactController {
  constructor(private readonly service: ContactService) {}

  @Get("api/contact")
  @ApiOperation({ summary: "Per-instance limit. Serverless instances don't share it, so it slows a single (GET)" })
  contactGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.contact(toEvent(req, res)))
  }

  @Post("api/contact")
  @HttpCode(200)
  @ApiOperation({ summary: "Per-instance limit. Serverless instances don't share it, so it slows a single (POST)" })
  @ApiBody({ schema: zodBodySchema(contactBodySchema) })
  contactPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.contact(toEvent(req, res)))
  }
}
