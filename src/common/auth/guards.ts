import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'
import { getSessionUser, requireAdmin, requireUser } from '../../auth/session'

/**
 * Global: resolves the signed-in user (session cookie or Bearer token) once per request and
 * caches it on the request for @CurrentUser(). Never blocks; a bad token just means no user.
 */
@Injectable()
export class AuthContextGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request & { authUser?: unknown }>()
    try {
      await getSessionUser(req)
    } catch {
      req.authUser = null
    }
    return true
  }
}

/** 401 unless signed in. */
@Injectable()
export class SignedInGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    await requireUser(context.switchToHttp().getRequest<Request>())
    return true
  }
}

/** 401 unless signed in, 403 unless the user has the Keycloak admin role. */
@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext) {
    await requireAdmin(context.switchToHttp().getRequest<Request>())
    return true
  }
}
