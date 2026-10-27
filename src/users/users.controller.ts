import { Controller, Delete, Get, HttpCode, Post, Put, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AdminOnly, Auth } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { zodBodySchema } from '../common/openapi'
import { idBodySchema } from './handlers/id'
import { UsersService } from './users.service'

@ApiTags("users")
@Controller()
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get("api/users")
  @ApiOperation({ summary: "Admin user list (admin-gated by server/middleware/auth-guard.ts) (GET)" })
  @ApiQuery({ name: "role", required: false })
  @AdminOnly()
  usersGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.users(toEvent(req, res)))
  }

  @Post("api/users")
  @HttpCode(200)
  @ApiOperation({ summary: "Admin user list (admin-gated by server/middleware/auth-guard.ts) (POST)" })
  @AdminOnly()
  usersPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.users(toEvent(req, res)))
  }

  @Get("api/users/:id")
  @ApiOperation({ summary: "No minimum here so older accounts with short usernames stay editable (GET)" })
  @ApiParam({ name: "id" })
  @Auth()
  idGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.id(toEvent(req, res)))
  }

  @Put("api/users/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "No minimum here so older accounts with short usernames stay editable (PUT)" })
  @ApiParam({ name: "id" })
  @ApiBody({ schema: zodBodySchema(idBodySchema) })
  @Auth()
  idPut(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.id(toEvent(req, res)))
  }

  @Delete("api/users/:id")
  @HttpCode(200)
  @ApiOperation({ summary: "No minimum here so older accounts with short usernames stay editable (DELETE)" })
  @ApiParam({ name: "id" })
  @Auth()
  idDelete(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.id(toEvent(req, res)))
  }
}
