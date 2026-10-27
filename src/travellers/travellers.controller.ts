import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { travellersPostBodySchema } from './handlers/travellers.post'
import { idPutBodySchema } from './handlers/id.put'
import { TravellersService } from './travellers.service'

@ApiTags("travellers")
@Controller()
export class TravellersController {
  constructor(private readonly service: TravellersService) {}

  @Get("api/travellers")
  @ApiOperation({ summary: "GET /api/travellers" })
  @Auth()
  travellersGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.travellersGet(toEvent(req, res)))
  }

  @Post("api/travellers")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/travellers" })
  @ApiBody({ schema: zodBodySchema(travellersPostBodySchema) })
  @Auth()
  travellersPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.travellersPost(toEvent(req, res)))
  }

  @Delete("api/travellers/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "DELETE /api/travellers/:id" })
  @ApiParam({ name: "id" })
  @Auth()
  idDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idDelete(toEvent(req, res)))
  }

  @Put("api/travellers/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "PUT /api/travellers/:id" })
  @ApiParam({ name: "id" })
  @ApiBody({ schema: zodBodySchema(idPutBodySchema) })
  @Auth()
  idPut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.idPut(toEvent(req, res)))
  }
}
