import { Controller, Get, HttpCode, Post, Query, Req, Res } from '@nestjs/common'
import { ApiExcludeEndpoint, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { Auth, CurrentUser } from '../common/auth/decorators'
import { safeReturnUrl } from '../common/allowed-origins'
import { useRuntimeConfig } from '../config/runtime-config'
import { claimReferralSignup } from '../referrals/services/referral-signup'
import { authorizationUrl, createPkce, endSessionUrl, exchangeCode, randomToken, verifyAccessToken, verifyIdToken } from './oidc'
import { clearAuthSession, setAuthSession, setLoginState, takeLoginState, userFromClaims, type AuthUser } from './session'
import { MeResponseDto } from './dto/me-response.dto'

const withError = (target: string, code: string) => {
  const url = new URL(target)
  url.searchParams.set('auth_error', code)
  return url.toString()
}

@ApiTags('auth')
@Controller()
export class AuthController {
  @Get('auth/login')
  @ApiOperation({
    summary: 'Start a Keycloak sign-in (browser redirect)',
    description: 'Redirects to auth.gotravelnha.com with Authorization Code + PKCE. After sign-in the browser returns to `redirect` with the session cookie set.'
  })
  @ApiQuery({ name: 'redirect', required: false, description: 'www or admin URL to return to' })
  @ApiQuery({ name: 'register', required: false, description: '`1` opens the registration page' })
  @ApiQuery({ name: 'ref', required: false, description: 'Referral code credited when a new account is created' })
  @ApiQuery({ name: 'locale', required: false, enum: ['en', 'vi', 'zh'] })
  async login(
    @Res() res: Response,
    @Query('redirect') redirect?: string,
    @Query('register') register?: string,
    @Query('ref') ref?: string,
    @Query('locale') locale?: string
  ) {
    const { verifier, challenge } = createPkce()
    const state = randomToken()
    const nonce = randomToken()
    await setLoginState(res, {
      state,
      nonce,
      verifier,
      redirect: safeReturnUrl(redirect),
      ref: typeof ref === 'string' && ref.length <= 40 ? ref : undefined
    })
    const uiLocale = locale && ['en', 'vi', 'zh'].includes(locale) ? (locale === 'zh' ? 'zh-CN' : locale) : undefined
    res.redirect(302, await authorizationUrl({ state, nonce, challenge, register: register === '1', locale: uiLocale }))
  }

  /** Keycloak redirects here (registered redirect URI: https://api.gotravelnha.com/auth/callback). */
  @Get('auth/callback')
  @ApiExcludeEndpoint()
  async callback(@Req() req: Request, @Res() res: Response, @Query() query: Record<string, string>) {
    const login = await takeLoginState(req, res)
    const siteRoot = `${String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')}/`
    const target = login?.redirect || siteRoot

    if (query.error) {
      // e.g. the user cancelled on the Keycloak page
      return res.redirect(302, withError(target, String(query.error)))
    }
    if (!login || typeof query.code !== 'string' || query.state !== login.state) {
      return res.redirect(302, withError(target, 'expired'))
    }

    try {
      const tokens = await exchangeCode(query.code, login.verifier)
      await verifyIdToken(tokens.id_token, login.nonce)
      // Roles and the stable `sub` come from the access token issued for this API
      const claims = await verifyAccessToken(tokens.access_token)
      const user = await userFromClaims(claims)
      if (!user.isActive) return res.redirect(302, withError(target, 'disabled'))
      // Only a brand-new account can be credited to a referrer
      if (login.ref && Date.now() - new Date(user.createdAt).getTime() < 60_000) await claimReferralSignup(login.ref, user.id)

      await setAuthSession(res, user.id, tokens.id_token)
      return res.redirect(302, target)
    } catch (error) {
      console.error('[auth] callback failed:', error)
      return res.redirect(302, withError(target, 'failed'))
    }
  }

  @Get('auth/logout')
  @ApiOperation({ summary: 'Sign out of GoTravelNha and Keycloak (browser redirect)' })
  @ApiQuery({ name: 'redirect', required: false, description: 'www or admin URL to return to' })
  async logoutRedirect(@Req() req: Request, @Res() res: Response, @Query('redirect') redirect?: string) {
    const target = safeReturnUrl(redirect)
    const idToken = await clearAuthSession(req, res)
    try {
      res.redirect(302, await endSessionUrl(target, idToken))
    } catch {
      res.redirect(302, target)
    }
  }

  @Get('api/auth/me')
  @Auth()
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOkResponse({ type: MeResponseDto })
  me(@CurrentUser() user: AuthUser) {
    return { success: true, user, role: user.role }
  }

  @Post('api/auth/logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'End the API session only', description: 'Browsers should use GET /auth/logout, which also ends the Keycloak session.' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await clearAuthSession(req, res)
    return { success: true }
  }
}
