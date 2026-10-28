import 'dotenv/config'
import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { SWAGGER_CSS } from './seo/brand'
import cookieParser from 'cookie-parser'
import { AppModule } from './app.module'
import { isAllowedOrigin } from './common/allowed-origins'

/** Builds the Nest app (used by `npm start` below and by the Vercel entry in api/index.ts). */
export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  app.set('trust proxy', true)
  app.use(cookieParser())
  // The affiliate click beacon from www is sent as text/plain to avoid a CORS preflight
  app.useBodyParser('text', { type: 'text/plain', limit: '64kb' })
  app.useBodyParser('json', { limit: '5mb' })

  // Public GETs (community feed, ...) are cached by Vercel's CDN. cors only adds `Vary: Origin` when a
  // request has an Origin, so a copy cached from a server-side fetch (no Origin, no CORS headers) was
  // served to browsers and blocked. Always vary on Origin so each origin gets its own cached copy.
  // Most responses depend on the session cookie (/api/auth/me, ...), so nothing is cached unless a
  // handler opts in (public feeds set their own cache-control). A browser-cached /api/auth/me fetched
  // from www was otherwise revalidated and reused for admin, with www's Access-Control-Allow-Origin.
  app.use((_req: unknown, res: { vary: (field: string) => void; setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.vary('Origin')
    res.setHeader('cache-control', 'private, no-store')
    next()
  })

  // www.gotravelnha.com and admin.gotravelnha.com call this API with the session cookie
  app.enableCors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin) ? origin : false),
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 600
  })

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('GoTravelNha API')
      .setDescription(
        'Backend for www.gotravelnha.com, admin.gotravelnha.com and the mobile app. ' +
          'Browsers sign in through `GET /auth/login` (Keycloak at auth.gotravelnha.com) and send the `gotravelnha_session` cookie; ' +
          'mobile sends `Authorization: Bearer <Keycloak access token>`.'
      )
      .setVersion('1.0')
      .addCookieAuth('gotravelnha_session', { type: 'apiKey', in: 'cookie', name: 'gotravelnha_session' }, 'session')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Keycloak access token (aud gotravelnha-api)' }, 'keycloak')
      .build()
  )
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    customSiteTitle: 'GoTravelNha API',
    customfavIcon: '/favicon.svg',
    customCss: SWAGGER_CSS
  })

  app.enableShutdownHooks()
  return app
}

async function bootstrap() {
  const app = await createApp()
  const port = Number(process.env.PORT || 3002)
  await app.listen(port)
  console.log(`GoTravelNha API on http://localhost:${port} (docs at /docs, health at /health)`)
}

if (require.main === module) {
  bootstrap()
}
