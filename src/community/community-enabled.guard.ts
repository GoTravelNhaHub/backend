import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { createError } from '../common/http-error'
import { useRuntimeConfig } from '../config/runtime-config'
import { communityEnabled } from '../shared/utils/feature-flags'

// Community API gate: 404 unless NUXT_PUBLIC_ENABLE_COMMUNITY is on. Writes that carry a foreign
// Origin are already refused globally (OriginCheckMiddleware); for writes without an Origin header,
// Sec-Fetch-Site must say the request came from one of our own sites.
@Injectable()
export class CommunityEnabledGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    if (!communityEnabled(useRuntimeConfig().public)) {
      throw createError({ statusCode: 404, message: 'Not found.' })
    }
    const req = context.switchToHttp().getRequest<Request>()
    const method = req.method.toUpperCase()
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS' || req.headers.origin) return true

    const site = req.headers['sec-fetch-site']
    if (site && !['same-origin', 'same-site', 'none'].includes(String(site))) {
      throw createError({ statusCode: 403, message: 'Request blocked.' })
    }
    return true
  }
}
