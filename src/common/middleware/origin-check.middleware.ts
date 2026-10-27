import { Injectable, NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { isAllowedOrigin } from '../allowed-origins'

// The session cookie is SameSite=Lax and every *.gotravelnha.com subdomain counts as same-site,
// so writes that carry a foreign Origin are refused here. CORS (main.ts) only decides what the
// browser may read. Server-to-server callers (partner conversion postbacks) send no Origin and are
// unaffected.
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const origin = req.headers.origin
    const method = req.method.toUpperCase()
    if (origin && !['GET', 'HEAD', 'OPTIONS'].includes(method) && !isAllowedOrigin(origin)) {
      res.status(403).json({ statusCode: 403, message: 'Request blocked.' })
      return
    }
    next()
  }
}
