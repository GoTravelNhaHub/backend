import { applyDecorators, createParamDecorator, ExecutionContext, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger'
import type { AuthUser } from '../../auth/session'
import { AdminGuard, SignedInGuard } from './guards'

/** The signed-in user, or null. Resolved by the global AuthContextGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser | null => {
  const req = context.switchToHttp().getRequest<{ authUser?: AuthUser | null }>()
  return req.authUser ?? null
})

/** Route or controller needs a signed-in user (cookie or Bearer). */
export const Auth = () =>
  applyDecorators(
    UseGuards(SignedInGuard),
    ApiCookieAuth('session'),
    ApiBearerAuth('keycloak'),
    ApiUnauthorizedResponse({ description: 'Not signed in' })
  )

/** Route or controller needs the admin role. */
export const AdminOnly = () =>
  applyDecorators(
    UseGuards(AdminGuard),
    ApiCookieAuth('session'),
    ApiBearerAuth('keycloak'),
    ApiUnauthorizedResponse({ description: 'Not signed in' }),
    ApiForbiddenResponse({ description: 'Admin role required' })
  )
