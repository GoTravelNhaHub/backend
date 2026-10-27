import { Controller, Get, Header, Req, Res } from '@nestjs/common'
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { send, toEvent } from '../common/http'
import { sitemapXml } from './handlers/sitemap.xml.get'

@ApiTags('seo')
@Controller()
export class SeoController {
  @Get('sitemap.xml')
  @ApiOperation({
    summary: 'Sitemap for www.gotravelnha.com',
    description: 'Built here because it needs the database; the site serves it at www.gotravelnha.com/sitemap.xml.'
  })
  sitemap(@Req() req: Request, @Res() res: Response) {
    return send(res, sitemapXml(toEvent(req, res)))
  }

  /** api.gotravelnha.com is not a website; keep crawlers out */
  @Get('robots.txt')
  @ApiExcludeEndpoint()
  @Header('content-type', 'text/plain; charset=utf-8')
  robots() {
    return 'User-agent: *\nDisallow: /\n'
  }

  /** The hand-written OpenAPI file this route used to serve was replaced by the generated spec */
  @Get('api/docs')
  @ApiExcludeEndpoint()
  docs(@Res() res: Response) {
    res.redirect(301, '/docs-json')
  }
}
