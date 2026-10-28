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
