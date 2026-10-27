import { Controller, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { SearchService } from './search.service'

@ApiTags("search")
@Controller()
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Post("api/search/global")
  @HttpCode(200)
  @ApiOperation({ summary: "POST /api/search/global" })
  @ApiQuery({ name: "toLowerCase", required: false })
  @ApiQuery({ name: "trim", required: false })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"category": {}, "limit": {"type": "number"}, "location": {"type": "string"}, "page": {"type": "number"}, "platforms": {}, "query": {"type": "string"}}} })
  globalPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.globalPost(toEvent(req, res)))
  }
}
