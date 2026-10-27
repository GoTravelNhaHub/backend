import { Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common'
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Auth } from '../common/auth/decorators'
import { send, toEvent } from '../common/http'
import { ReferralsService } from './referrals.service'

@ApiTags("referrals")
@Controller()
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}

  @Get("api/referrals/create")
  @ApiOperation({ summary: "Create a pending referral code for the signed-in user. (GET)" })
  @Auth()
  createGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.create(toEvent(req, res)))
  }

  @Post("api/referrals/create")
  @HttpCode(200)
  @ApiOperation({ summary: "Create a pending referral code for the signed-in user. (POST)" })
  @Auth()
  createPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.create(toEvent(req, res)))
  }

  @Get("api/referrals/my-code")
  @ApiOperation({ summary: "The signed-in user's own referral code. (GET)" })
  @Auth()
  myCodeGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.myCode(toEvent(req, res)))
  }

  @Post("api/referrals/my-code")
  @HttpCode(200)
  @ApiOperation({ summary: "The signed-in user's own referral code. (POST)" })
  @Auth()
  myCodePost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.myCode(toEvent(req, res)))
  }

  @Get("api/referrals/stats")
  @ApiOperation({ summary: "Referral stats for the signed-in user. The client cannot pick another userId. (GET)" })
  @Auth()
  statsGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.stats(toEvent(req, res)))
  }

  @Post("api/referrals/stats")
  @HttpCode(200)
  @ApiOperation({ summary: "Referral stats for the signed-in user. The client cannot pick another userId. (POST)" })
  @Auth()
  statsPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.stats(toEvent(req, res)))
  }

  @Get("api/referrals/track-click")
  @ApiOperation({ summary: "Record that a referral link was opened. Does not accept a user id or an email. (GET)" })
  trackClickGet(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trackClick(toEvent(req, res)))
  }

  @Post("api/referrals/track-click")
  @HttpCode(200)
  @ApiOperation({ summary: "Record that a referral link was opened. Does not accept a user id or an email. (POST)" })
  @ApiBody({ required: false, schema: {"type": "object", "properties": {"code": {"type": "string"}}} })
  trackClickPost(@Req() req: Request, @Res() res: Response) {
    return send(res, this.service.trackClick(toEvent(req, res)))
  }
}
