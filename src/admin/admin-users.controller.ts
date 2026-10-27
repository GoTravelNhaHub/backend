import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { usersBodySchema } from './handlers/users'
import { AdminService } from './admin.service'

@ApiTags("admin: users")
@Controller()
export class AdminUsersController {
  constructor(private readonly service: AdminService) {}

  @Get("api/admin/users")
  @ApiOperation({ summary: "Admin creates an account with any role (admin-gated by server/middleware/auth-guard.ts). (GET)" })
  @AdminOnly()
  usersGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.users(toEvent(req, res)))
  }

  @Post("api/admin/users")
  @HttpCode(200)
  @ApiOperation({ summary: "Admin creates an account with any role (admin-gated by server/middleware/auth-guard.ts). (POST)" })
  @ApiBody({ schema: zodBodySchema(usersBodySchema) })
  @AdminOnly()
  usersPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.users(toEvent(req, res)))
  }
}
